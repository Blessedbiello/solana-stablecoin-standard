/**
 * Compliance service.
 *
 * Provides a service-layer facade over:
 *   - Blacklist management (add / remove / query)
 *   - Audit log queries
 *
 * Actual on-chain submission is handled by the Solana instruction builders in
 * this module; the SQLite operations are handled via the db helpers.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import crypto from "crypto";
import config from "../config.js";
import logger from "../logger.js";
import {
  queryEvents,
  queryAuditLog,
  insertAuditLog,
  AuditQuery,
  EventRow,
} from "../db/index.js";

// ── PDA derivation ────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(config.programId);

function deriveBlacklistPda(configPda: PublicKey, address: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), configPda.toBytes(), address.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

function serializeU64LE(value: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

function deriveConfigPda(authority: PublicKey, configId: bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("stablecoin_config"),
      authority.toBytes(),
      Buffer.from(serializeU64LE(configId)),
    ],
    PROGRAM_ID
  );
  return pda;
}

// ── Instruction discriminators ────────────────────────────────────────────────

const DISCRIMINATORS = {
  add_to_blacklist: Buffer.from([216, 125, 90, 238, 100, 80, 232, 138]),
  remove_from_blacklist: Buffer.from([104, 50, 197, 212, 225, 219, 32, 97]),
} as const;

// ── Reason hashing ────────────────────────────────────────────────────────────

/**
 * Hash a human-readable reason string to the 32-byte array expected by the
 * `add_to_blacklist` instruction.
 */
export function hashReason(reason: string): Uint8Array {
  return crypto.createHash("sha256").update(reason, "utf8").digest();
}

// ── On-chain instructions ─────────────────────────────────────────────────────

export interface BlacklistAddParams {
  authority: PublicKey;
  configId: bigint;
  blacklister: PublicKey;
  target: PublicKey;
  reason: string;
}

export function buildAddBlacklistInstruction(
  params: BlacklistAddParams
): TransactionInstruction {
  const configPda = deriveConfigPda(params.authority, params.configId);
  const blacklistPda = deriveBlacklistPda(configPda, params.target);
  const reasonHash = hashReason(params.reason);

  const data = Buffer.concat([DISCRIMINATORS.add_to_blacklist, reasonHash]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.blacklister, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: blacklistPda, isSigner: false, isWritable: true },
      { pubkey: params.target, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export interface BlacklistRemoveParams {
  authority: PublicKey;
  configId: bigint;
  blacklister: PublicKey;
  target: PublicKey;
}

export function buildRemoveBlacklistInstruction(
  params: BlacklistRemoveParams
): TransactionInstruction {
  const configPda = deriveConfigPda(params.authority, params.configId);
  const blacklistPda = deriveBlacklistPda(configPda, params.target);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.blacklister, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: blacklistPda, isSigner: false, isWritable: true },
      { pubkey: params.target, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.remove_from_blacklist,
  });
}

// ── High-level service methods ────────────────────────────────────────────────

export interface AddToBlacklistServiceParams {
  authority: string;
  configId: bigint;
  blacklisterKeypair: Keypair;
  target: string;
  reason: string;
  /** Actor identifier for the audit log (e.g. API key principal). */
  actorLabel: string;
}

/**
 * Submit an `add_to_blacklist` transaction and record the action in the
 * audit log.
 */
export async function addToBlacklist(params: AddToBlacklistServiceParams): Promise<string> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const authority = new PublicKey(params.authority);
  const target = new PublicKey(params.target);

  const ix = buildAddBlacklistInstruction({
    authority,
    configId: params.configId,
    blacklister: params.blacklisterKeypair.publicKey,
    target,
    reason: params.reason,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [params.blacklisterKeypair],
    { commitment: "confirmed" }
  );

  insertAuditLog({
    action: "blacklist_add",
    actor: params.actorLabel,
    target: params.target,
    details: { txSig: sig, reason: params.reason },
  });

  logger.info({ target: params.target, sig }, "Address blacklisted");
  return sig;
}

export interface RemoveFromBlacklistServiceParams {
  authority: string;
  configId: bigint;
  blacklisterKeypair: Keypair;
  target: string;
  actorLabel: string;
}

/**
 * Submit a `remove_from_blacklist` transaction and record the action.
 */
export async function removeFromBlacklist(
  params: RemoveFromBlacklistServiceParams
): Promise<string> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const authority = new PublicKey(params.authority);
  const target = new PublicKey(params.target);

  const ix = buildRemoveBlacklistInstruction({
    authority,
    configId: params.configId,
    blacklister: params.blacklisterKeypair.publicKey,
    target,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [params.blacklisterKeypair],
    { commitment: "confirmed" }
  );

  insertAuditLog({
    action: "blacklist_remove",
    actor: params.actorLabel,
    target: params.target,
    details: { txSig: sig },
  });

  logger.info({ target: params.target, sig }, "Address removed from blacklist");
  return sig;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export interface BlacklistEntry {
  address: string;
  config: string;
  txSig: string;
  slot: number;
  timestamp: number;
}

/**
 * Return all addresses currently on the blacklist for a given config.
 * Computed from the indexed AddressBlacklisted / AddressUnblacklisted events.
 */
export function getBlacklistedAddresses(configPda?: string): BlacklistEntry[] {
  const addedEvents: EventRow[] = queryEvents({
    config: configPda,
    eventType: "AddressBlacklisted",
    limit: 5000,
  });

  const removedEvents: EventRow[] = queryEvents({
    config: configPda,
    eventType: "AddressUnblacklisted",
    limit: 5000,
  });

  // Build a set of removed addresses per config
  const removed = new Set<string>();
  for (const ev of removedEvents) {
    try {
      const d = JSON.parse(ev.data) as { address?: string };
      if (d.address) removed.add(`${ev.config}:${d.address}`);
    } catch { /* skip */ }
  }

  const result: BlacklistEntry[] = [];
  for (const ev of addedEvents) {
    try {
      const d = JSON.parse(ev.data) as { address?: string };
      if (!d.address) continue;
      const key = `${ev.config}:${d.address}`;
      if (removed.has(key)) continue;
      result.push({
        address: d.address,
        config: ev.config,
        txSig: ev.tx_sig,
        slot: ev.slot,
        timestamp: ev.timestamp,
      });
    } catch { /* skip malformed rows */ }
  }

  return result;
}

/**
 * Thin wrapper around the db audit log query.
 */
export function getAuditLog(query: AuditQuery) {
  return queryAuditLog(query);
}
