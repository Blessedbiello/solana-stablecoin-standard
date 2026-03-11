import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import config from "../config.js";
import logger from "../logger.js";
import { SCHEMA_STATEMENTS } from "./schema.js";

let db: Database.Database | null = null;

// ── Initialization ────────────────────────────────────────────────────────────

/** Initialise (or re-use) the singleton SQLite connection. */
export function initDb(): Database.Database {
  if (db) return db;

  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -16000"); // ~16 MB

  // Apply schema
  for (const stmt of SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }

  logger.info({ dbPath }, "Database initialised");
  return db;
}

/** Return the singleton database connection (must call initDb first). */
export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialised. Call initDb() first.");
  return db;
}

/** Gracefully close the database connection. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("Database connection closed");
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  event_type: string;
  config: string;
  data: string;
  tx_sig: string;
  slot: number;
  timestamp: number;
}

export interface AuditRow {
  id: string;
  action: string;
  actor: string;
  target: string | null;
  details: string;
  timestamp: number;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string;
  active: number;
  secret: string;
  created_at: number;
}

export interface DeliveryRow {
  id: string;
  webhook_id: string;
  event_id: string;
  status: string;
  attempts: number;
  next_attempt: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

// ── Event helpers ─────────────────────────────────────────────────────────────

export interface InsertEventParams {
  eventType: string;
  config: string;
  data: Record<string, unknown>;
  txSig: string;
  slot: number;
}

/**
 * Insert a parsed on-chain event. Returns the new row id.
 * Silently ignores duplicate tx_sig + event_type pairs.
 */
export function insertEvent(params: InsertEventParams): string {
  const database = getDb();
  const id = uuidv4();
  const now = Date.now();

  database
    .prepare(
      `INSERT OR IGNORE INTO events (id, event_type, config, data, tx_sig, slot, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.eventType,
      params.config,
      JSON.stringify(params.data),
      params.txSig,
      params.slot,
      now
    );

  return id;
}

export interface EventQuery {
  config?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
  sinceSlot?: number;
}

/** Query events with optional filters. */
export function queryEvents(query: EventQuery = {}): EventRow[] {
  const database = getDb();
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (query.config) {
    conditions.push("config = ?");
    bindings.push(query.config);
  }
  if (query.eventType) {
    conditions.push("event_type = ?");
    bindings.push(query.eventType);
  }
  if (query.sinceSlot !== undefined) {
    conditions.push("slot >= ?");
    bindings.push(query.sinceSlot);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  return database
    .prepare(
      `SELECT * FROM events ${where} ORDER BY slot DESC, rowid DESC LIMIT ? OFFSET ?`
    )
    .all(...bindings, limit, offset) as EventRow[];
}

// ── Audit helpers ─────────────────────────────────────────────────────────────

export interface InsertAuditParams {
  action: string;
  actor: string;
  target?: string;
  details: Record<string, unknown>;
}

/** Record an administrative action to the audit log. */
export function insertAuditLog(params: InsertAuditParams): string {
  const database = getDb();
  const id = uuidv4();

  database
    .prepare(
      `INSERT INTO audit_log (id, action, actor, target, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.action,
      params.actor,
      params.target ?? null,
      JSON.stringify(params.details),
      Date.now()
    );

  return id;
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

/** Query the audit log with optional filters. */
export function queryAuditLog(query: AuditQuery = {}): AuditRow[] {
  const database = getDb();
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (query.actor) {
    conditions.push("actor = ?");
    bindings.push(query.actor);
  }
  if (query.action) {
    conditions.push("action = ?");
    bindings.push(query.action);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  return database
    .prepare(
      `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .all(...bindings, limit, offset) as AuditRow[];
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

export interface InsertWebhookParams {
  url: string;
  events: string[];
  secret?: string;
}

/** Register a new webhook subscription. */
export function insertWebhook(params: InsertWebhookParams): WebhookRow {
  const database = getDb();
  const id = uuidv4();
  const now = Date.now();

  database
    .prepare(
      `INSERT INTO webhooks (id, url, events, active, secret, created_at)
       VALUES (?, ?, ?, 1, ?, ?)`
    )
    .run(id, params.url, JSON.stringify(params.events), params.secret ?? "", now);

  return database
    .prepare("SELECT * FROM webhooks WHERE id = ?")
    .get(id) as WebhookRow;
}

/** List all webhooks, optionally only active ones. */
export function listWebhooks(activeOnly = false): WebhookRow[] {
  const database = getDb();
  const sql = activeOnly
    ? "SELECT * FROM webhooks WHERE active = 1 ORDER BY created_at ASC"
    : "SELECT * FROM webhooks ORDER BY created_at ASC";
  return database.prepare(sql).all() as WebhookRow[];
}

/** Soft-delete (deactivate) a webhook by id. Returns true if found. */
export function deleteWebhook(id: string): boolean {
  const database = getDb();
  const result = database
    .prepare("UPDATE webhooks SET active = 0 WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

// ── Delivery queue helpers ────────────────────────────────────────────────────

/** Enqueue a delivery task for a specific webhook + event pair. */
export function enqueueDelivery(webhookId: string, eventId: string): string {
  const database = getDb();
  const id = uuidv4();
  const now = Date.now();

  database
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
       (id, webhook_id, event_id, status, attempts, next_attempt, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)`
    )
    .run(id, webhookId, eventId, now, now, now);

  return id;
}

/** Fetch deliveries that are ready to attempt (next_attempt <= now). */
export function pendingDeliveries(limit = 50): DeliveryRow[] {
  const database = getDb();
  return database
    .prepare(
      `SELECT * FROM webhook_deliveries
       WHERE status = 'pending' AND next_attempt <= ?
       ORDER BY next_attempt ASC
       LIMIT ?`
    )
    .all(Date.now(), limit) as DeliveryRow[];
}

/** Mark a delivery as successfully delivered. */
export function markDeliveryDone(id: string): void {
  getDb()
    .prepare(
      "UPDATE webhook_deliveries SET status = 'done', updated_at = ? WHERE id = ?"
    )
    .run(Date.now(), id);
}

/** Record a failed delivery attempt and schedule the next retry. */
export function markDeliveryFailed(
  id: string,
  error: string,
  nextAttemptAt: number
): void {
  getDb()
    .prepare(
      `UPDATE webhook_deliveries
       SET status = 'pending', attempts = attempts + 1, last_error = ?, next_attempt = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(error, nextAttemptAt, Date.now(), id);
}

/** Permanently abandon a delivery after max retries. */
export function markDeliveryAbandoned(id: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE webhook_deliveries
       SET status = 'abandoned', attempts = attempts + 1, last_error = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(error, Date.now(), id);
}
