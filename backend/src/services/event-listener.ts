/**
 * Solana program log listener.
 *
 * Uses `connection.onLogs(programId, ...)` to receive a stream of transaction
 * logs from the sss-token program, then extracts Anchor event data from the
 * base64-encoded log lines and persists them to SQLite.
 */

import { Connection, PublicKey, Logs } from "@solana/web3.js";
import config from "../config.js";
import logger from "../logger.js";
import {
  insertEvent,
  listWebhooks,
  enqueueDelivery,
  queryEvents,
  WebhookRow,
} from "../db/index.js";

// ── Anchor event discriminator ────────────────────────────────────────────────
// Anchor encodes events inside "Program data: <base64>" log lines.
const PROGRAM_DATA_PREFIX = "Program data: ";

// Map of Anchor event discriminator prefix (first 8 bytes of sha256("event:<EventName>"))
// to human-readable event_type strings.  We use a name-based check instead of
// recomputing discriminators so the backend doesn't need the IDL at runtime.
const EVENT_TYPE_PATTERNS: [RegExp, string][] = [
  [/StablecoinInitialized/, "StablecoinInitialized"],
  [/TokensMinted/, "TokensMinted"],
  [/TokensBurned/, "TokensBurned"],
  [/AccountFrozen/, "AccountFrozen"],
  [/AccountThawed/, "AccountThawed"],
  [/StablecoinPaused/, "StablecoinPaused"],
  [/StablecoinUnpaused/, "StablecoinUnpaused"],
  [/MinterUpdated/, "MinterUpdated"],
  [/RoleAssigned/, "RoleAssigned"],
  [/RoleRevoked/, "RoleRevoked"],
  [/AuthorityTransferInitiated/, "AuthorityTransferInitiated"],
  [/AuthorityTransferred/, "AuthorityTransferred"],
  [/AddressBlacklisted/, "AddressBlacklisted"],
  [/AddressUnblacklisted/, "AddressUnblacklisted"],
  [/TokensSeized/, "TokensSeized"],
];

// ── Log parsing ───────────────────────────────────────────────────────────────

/**
 * Extract the Anchor event type from a raw log line that starts with
 * "Program data: ".  Returns null for non-event lines.
 *
 * Anchor serialises events as Borsh-encoded bytes prefixed by an 8-byte
 * discriminator.  For our purposes we decode the base64 payload and look
 * for a UTF-8 string fragment that matches a known event name — this avoids
 * needing to implement full Borsh deserialization in the backend.
 */
function parseAnchorEventLog(
  logLine: string,
  txSig: string,
  slot: number
): { eventType: string; data: Record<string, unknown>; config: string } | null {
  if (!logLine.startsWith(PROGRAM_DATA_PREFIX)) return null;

  const b64 = logLine.slice(PROGRAM_DATA_PREFIX.length).trim();
  let raw: Buffer;
  try {
    raw = Buffer.from(b64, "base64");
  } catch {
    return null;
  }

  // Skip the 8-byte discriminator and try to decode the rest as a JSON-like
  // string or detect the event type from the binary content.
  const payload = raw.slice(8);
  const payloadStr = payload.toString("utf8");

  // Determine event type by scanning for known name fragments in the raw bytes.
  let eventType: string | null = null;
  for (const [pattern, name] of EVENT_TYPE_PATTERNS) {
    if (pattern.test(payloadStr)) {
      eventType = name;
      break;
    }
  }

  if (!eventType) {
    // Unknown event — store it generically for debugging
    eventType = "Unknown";
  }

  // Extract the config pubkey (first 32 bytes after discriminator, base58 encoded).
  // All SSS events have `config: Pubkey` as the first field.
  let configPubkey = "unknown";
  if (payload.length >= 32) {
    try {
      const pkBytes = payload.slice(0, 32);
      configPubkey = new PublicKey(pkBytes).toBase58();
    } catch {
      // Not a valid pubkey — ignore
    }
  }

  // Store the raw hex for the consumer; callers can decode with the IDL.
  const data: Record<string, unknown> = {
    raw: raw.toString("hex"),
    b64,
    txSig,
    slot,
  };

  // Filter by watched configs if configured
  if (
    config.watchConfigs.length > 0 &&
    configPubkey !== "unknown" &&
    !config.watchConfigs.includes(configPubkey)
  ) {
    return null;
  }

  return { eventType, data, config: configPubkey };
}

// ── Subscription management ───────────────────────────────────────────────────

let subscriptionId: number | null = null;
let connection: Connection | null = null;

/**
 * Fan-out a newly stored event to all matching active webhook subscriptions
 * by inserting delivery queue rows.
 */
function fanOutToWebhooks(eventId: string, eventType: string): void {
  try {
    const hooks: WebhookRow[] = listWebhooks(true);
    for (const hook of hooks) {
      const subscribedEvents: string[] = JSON.parse(hook.events) as string[];
      const matchAll = subscribedEvents.includes("*");
      if (matchAll || subscribedEvents.includes(eventType)) {
        enqueueDelivery(hook.id, eventId);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to fan-out event to webhooks");
  }
}

/** Handle a raw log notification from the WebSocket subscription. */
function handleLogs(logs: Logs): void {
  const { signature, logs: lines, err } = logs;

  if (err) {
    // Failed transaction — skip
    return;
  }

  // Anchor emits slot information separately; we use 0 as a placeholder here.
  // The slot is enriched asynchronously when we confirm the transaction.
  const slot = 0;

  for (const line of lines) {
    const parsed = parseAnchorEventLog(line, signature, slot);
    if (!parsed) continue;

    try {
      const eventId = insertEvent({
        eventType: parsed.eventType,
        config: parsed.config,
        data: parsed.data,
        txSig: signature,
        slot,
      });

      logger.info(
        { eventType: parsed.eventType, config: parsed.config, txSig: signature },
        "Event indexed"
      );

      fanOutToWebhooks(eventId, parsed.eventType);
    } catch (err) {
      logger.error({ err, signature }, "Failed to insert event");
    }
  }
}

/**
 * Start listening for sss-token program logs via WebSocket.
 * Idempotent — calling a second time is a no-op.
 */
export async function startEventListener(): Promise<void> {
  if (subscriptionId !== null) {
    logger.warn("Event listener already running");
    return;
  }

  connection = new Connection(config.rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: config.rpcWsUrl,
  });

  const programId = new PublicKey(config.programId);

  subscriptionId = connection.onLogs(
    programId,
    (logs) => {
      try {
        handleLogs(logs);
      } catch (err) {
        logger.error({ err }, "Unhandled error in log handler");
      }
    },
    "confirmed"
  );

  logger.info(
    { programId: config.programId, subscriptionId },
    "Solana log subscription active"
  );

  // Enrich historical slot numbers asynchronously for recent transactions
  // that may have been processed before the WebSocket connected.
  void enrichRecentSlots(connection);
}

/**
 * Stop the WebSocket subscription.
 */
export async function stopEventListener(): Promise<void> {
  if (subscriptionId === null || !connection) return;

  await connection.removeOnLogsListener(subscriptionId);
  subscriptionId = null;
  connection = null;
  logger.info("Solana log subscription removed");
}

/**
 * Back-fill the `slot` field for any events stored with slot=0 by looking
 * up the transaction on-chain.  Runs in a fire-and-forget fashion.
 */
async function enrichRecentSlots(conn: Connection): Promise<void> {
  try {
    const rows = queryEvents({ sinceSlot: 0, limit: 200 });
    const toEnrich = rows.filter((r) => r.slot === 0);

    for (const row of toEnrich) {
      try {
        const tx = await conn.getTransaction(row.tx_sig, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (tx?.slot) {
          const db = (await import("../db/index.js")).getDb();
          db.prepare("UPDATE events SET slot = ? WHERE id = ?").run(tx.slot, row.id);
        }
      } catch {
        // Best-effort; ignore individual failures
      }
    }
  } catch (err) {
    logger.warn({ err }, "Slot enrichment sweep failed");
  }
}
