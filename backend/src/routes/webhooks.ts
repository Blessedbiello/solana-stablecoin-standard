/**
 * Webhook management routes.
 *
 * Allows callers to register, list, and delete webhook subscriptions.
 * Delivery is handled by the background worker process.
 */

import { Router, Request, Response, NextFunction } from "express";
import { URL } from "url";
import config from "../config.js";
import logger from "../logger.js";
import {
  insertWebhook,
  listWebhooks,
  deleteWebhook,
  WebhookRow,
} from "../db/index.js";

export const webhooksRouter = Router();

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminApiKey) {
    next();
    return;
  }
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== config.adminApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Validation helpers ────────────────────────────────────────────────────────

const KNOWN_EVENT_TYPES = new Set([
  "*",
  "StablecoinInitialized",
  "TokensMinted",
  "TokensBurned",
  "AccountFrozen",
  "AccountThawed",
  "StablecoinPaused",
  "StablecoinUnpaused",
  "MinterUpdated",
  "RoleAssigned",
  "RoleRevoked",
  "AuthorityTransferInitiated",
  "AuthorityTransferred",
  "AddressBlacklisted",
  "AddressUnblacklisted",
  "TokensSeized",
]);

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEventList(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((v) => typeof v === "string" && KNOWN_EVENT_TYPES.has(v));
}

/** Strip the secret before sending a webhook row to the API consumer. */
function sanitizeWebhook(row: WebhookRow) {
  return {
    id: row.id,
    url: row.url,
    events: JSON.parse(row.events) as string[],
    active: row.active === 1,
    created_at: row.created_at,
  };
}

// ── POST /api/v1/webhooks ─────────────────────────────────────────────────────

webhooksRouter.post("/", requireApiKey, (req: Request, res: Response) => {
  const { url, events, secret } = req.body as Record<string, unknown>;

  if (!isValidUrl(url)) {
    res.status(400).json({
      error: "'url' must be a valid http:// or https:// URL",
    });
    return;
  }

  if (!isValidEventList(events)) {
    res.status(400).json({
      error:
        "'events' must be a non-empty array of valid event type strings. " +
        `Use '*' to subscribe to all. Known types: ${[...KNOWN_EVENT_TYPES].filter((e) => e !== "*").join(", ")}`,
    });
    return;
  }

  const secretStr = typeof secret === "string" ? secret : "";

  try {
    const row = insertWebhook({ url, events, secret: secretStr });
    logger.info({ id: row.id, url, events }, "Webhook registered");
    res.status(201).json(sanitizeWebhook(row));
  } catch (err) {
    logger.error({ err }, "Failed to register webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/v1/webhooks ──────────────────────────────────────────────────────

webhooksRouter.get("/", requireApiKey, (_req: Request, res: Response) => {
  try {
    const rows = listWebhooks();
    res.json({
      count: rows.length,
      webhooks: rows.map(sanitizeWebhook),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list webhooks");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/v1/webhooks/:id ───────────────────────────────────────────────

webhooksRouter.delete("/:id", requireApiKey, (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing webhook id" });
    return;
  }

  try {
    const found = deleteWebhook(id);
    if (!found) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    logger.info({ id }, "Webhook deleted");
    res.json({ message: "Webhook deleted", id });
  } catch (err) {
    logger.error({ err }, "Failed to delete webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});
