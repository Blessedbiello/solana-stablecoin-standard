/**
 * SQLite schema definitions.
 *
 * All DDL statements are idempotent (CREATE TABLE IF NOT EXISTS + CREATE INDEX
 * IF NOT EXISTS) so they can be safely re-run on every startup.
 */

export const SCHEMA_STATEMENTS: string[] = [
  // ── events ──────────────────────────────────────────────────────────────────
  // Raw on-chain events parsed from Anchor log output.
  `CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    config      TEXT NOT NULL,
    data        TEXT NOT NULL,
    tx_sig      TEXT NOT NULL,
    slot        INTEGER NOT NULL,
    timestamp   INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_config
    ON events (config)`,
  `CREATE INDEX IF NOT EXISTS idx_events_event_type
    ON events (event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_slot
    ON events (slot)`,
  `CREATE INDEX IF NOT EXISTS idx_events_tx_sig
    ON events (tx_sig)`,

  // ── audit_log ────────────────────────────────────────────────────────────────
  // Administrative actions submitted through the API.
  `CREATE TABLE IF NOT EXISTS audit_log (
    id        TEXT PRIMARY KEY,
    action    TEXT NOT NULL,
    actor     TEXT NOT NULL,
    target    TEXT,
    details   TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_log (actor)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_action
    ON audit_log (action)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_timestamp
    ON audit_log (timestamp)`,

  // ── webhooks ─────────────────────────────────────────────────────────────────
  // Registered webhook subscriptions.
  `CREATE TABLE IF NOT EXISTS webhooks (
    id        TEXT PRIMARY KEY,
    url       TEXT NOT NULL,
    events    TEXT NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1,
    secret    TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,

  // ── webhook_deliveries ───────────────────────────────────────────────────────
  // Per-event delivery queue for the worker process.
  `CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id          TEXT PRIMARY KEY,
    webhook_id  TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INTEGER NOT NULL DEFAULT 0,
    next_attempt INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deliveries_pending
    ON webhook_deliveries (status, next_attempt)`,
  `CREATE INDEX IF NOT EXISTS idx_deliveries_webhook
    ON webhook_deliveries (webhook_id)`,
];
