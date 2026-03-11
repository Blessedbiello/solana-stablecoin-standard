/**
 * Webhook delivery service.
 *
 * Polls the `webhook_deliveries` table for pending deliveries and attempts
 * HTTP POST to the registered URLs.  Failed deliveries are retried with
 * exponential backoff up to MAX_RETRIES.
 *
 * Payload format:
 *   POST <url>
 *   Content-Type: application/json
 *   X-SSS-Signature: sha256=<hmac-sha256-hex>
 *   X-SSS-Event: <event_type>
 *
 * Signature: HMAC-SHA256(webhookSecretKey, JSON.stringify(body))
 */

import https from "https";
import http from "http";
import { URL } from "url";
import crypto from "crypto";
import config from "../config.js";
import logger from "../logger.js";
import {
  pendingDeliveries,
  markDeliveryDone,
  markDeliveryFailed,
  markDeliveryAbandoned,
  getDb,
  DeliveryRow,
  EventRow,
  WebhookRow,
} from "../db/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_000; // 1 second
const MAX_BACKOFF_MS = 5 * 60 * 1_000; // 5 minutes

// ── HMAC signing ──────────────────────────────────────────────────────────────

function sign(body: string, secret: string): string {
  if (!secret) return "";
  const mac = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${mac}`;
}

// ── HTTP delivery ─────────────────────────────────────────────────────────────

interface DeliveryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Perform a single HTTP POST delivery.
 * Resolves (never rejects) with a DeliveryResult.
 */
function deliver(
  url: string,
  body: string,
  signature: string,
  eventType: string
): Promise<DeliveryResult> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, error: `Invalid URL: ${url}` });
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const bodyBuf = Buffer.from(body, "utf8");
    const options = {
      method: "POST",
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyBuf.length,
        "X-SSS-Signature": signature,
        "X-SSS-Event": eventType,
        "User-Agent": "SSS-Webhook/1.0",
      },
      timeout: 10_000,
    };

    const req = transport.request(options, (res) => {
      // Drain the response body
      res.resume();
      res.on("end", () => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode >= 200 && statusCode < 300) {
          resolve({ ok: true, statusCode });
        } else {
          resolve({ ok: false, statusCode, error: `HTTP ${statusCode}` });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Request timed out" });
    });

    req.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.write(bodyBuf);
    req.end();
  });
}

// ── Backoff calculation ───────────────────────────────────────────────────────

function nextBackoffMs(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 5 min)
  const backoff = BASE_BACKOFF_MS * Math.pow(2, attemptNumber);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

// ── Core processing ───────────────────────────────────────────────────────────

interface ProcessableDelivery {
  delivery: DeliveryRow;
  event: EventRow;
  webhook: WebhookRow;
}

function loadDeliveryContext(delivery: DeliveryRow): ProcessableDelivery | null {
  const db = getDb();

  const event = db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(delivery.event_id) as EventRow | undefined;

  const webhook = db
    .prepare("SELECT * FROM webhooks WHERE id = ?")
    .get(delivery.webhook_id) as WebhookRow | undefined;

  if (!event || !webhook) return null;
  return { delivery, event, webhook };
}

async function processDelivery(ctx: ProcessableDelivery): Promise<void> {
  const { delivery, event, webhook } = ctx;

  // Deserialise stored event data
  let eventData: unknown;
  try {
    eventData = JSON.parse(event.data);
  } catch {
    eventData = event.data;
  }

  const body = JSON.stringify({
    id: event.id,
    event_type: event.event_type,
    config: event.config,
    tx_sig: event.tx_sig,
    slot: event.slot,
    timestamp: event.timestamp,
    data: eventData,
  });

  const signature = sign(body, webhook.secret || config.webhookSecretKey);

  logger.debug(
    { deliveryId: delivery.id, webhookId: webhook.id, url: webhook.url, eventType: event.event_type },
    "Attempting webhook delivery"
  );

  const result = await deliver(webhook.url, body, signature, event.event_type);

  if (result.ok) {
    markDeliveryDone(delivery.id);
    logger.info(
      { deliveryId: delivery.id, url: webhook.url, statusCode: result.statusCode },
      "Webhook delivered successfully"
    );
    return;
  }

  const newAttempts = delivery.attempts + 1;
  if (newAttempts >= MAX_RETRIES) {
    markDeliveryAbandoned(delivery.id, result.error ?? "unknown");
    logger.warn(
      { deliveryId: delivery.id, url: webhook.url, error: result.error, attempts: newAttempts },
      "Webhook delivery abandoned after max retries"
    );
    return;
  }

  const nextAttempt = Date.now() + nextBackoffMs(newAttempts);
  markDeliveryFailed(delivery.id, result.error ?? "unknown", nextAttempt);
  logger.warn(
    {
      deliveryId: delivery.id,
      url: webhook.url,
      error: result.error,
      attempts: newAttempts,
      nextAttemptIn: `${Math.round(nextBackoffMs(newAttempts) / 1000)}s`,
    },
    "Webhook delivery failed, will retry"
  );
}

// ── Worker loop ───────────────────────────────────────────────────────────────

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function runDeliveryBatch(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const deliveries = pendingDeliveries(config.webhookConcurrency * 2);
    if (deliveries.length === 0) return;

    logger.debug({ count: deliveries.length }, "Processing delivery batch");

    // Load context for each delivery
    const contexts = deliveries
      .map(loadDeliveryContext)
      .filter((c): c is ProcessableDelivery => c !== null);

    // Process in chunks respecting the concurrency limit
    for (let i = 0; i < contexts.length; i += config.webhookConcurrency) {
      const chunk = contexts.slice(i, i + config.webhookConcurrency);
      await Promise.allSettled(chunk.map(processDelivery));
    }
  } catch (err) {
    logger.error({ err }, "Delivery batch processing error");
  } finally {
    running = false;
  }
}

/**
 * Start the background webhook worker.
 * Polls the delivery queue every `webhookPollIntervalMs` milliseconds.
 */
export function startWebhookWorker(): void {
  if (workerTimer !== null) {
    logger.warn("Webhook worker already running");
    return;
  }

  logger.info(
    { pollIntervalMs: config.webhookPollIntervalMs, concurrency: config.webhookConcurrency },
    "Webhook worker started"
  );

  const tick = () => {
    runDeliveryBatch().finally(() => {
      workerTimer = setTimeout(tick, config.webhookPollIntervalMs);
    });
  };

  // Kick off immediately
  workerTimer = setTimeout(tick, 0);
}

/**
 * Stop the webhook worker gracefully.
 */
export function stopWebhookWorker(): void {
  if (workerTimer !== null) {
    clearTimeout(workerTimer);
    workerTimer = null;
    logger.info("Webhook worker stopped");
  }
}
