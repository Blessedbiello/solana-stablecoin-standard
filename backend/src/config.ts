import "dotenv/config";

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: ${raw}`);
  }
  return parsed;
}

function optionalBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

export type AppMode = "api" | "indexer" | "worker";

function parseMode(raw: string): AppMode {
  if (raw === "api" || raw === "indexer" || raw === "worker") return raw;
  throw new Error(`Invalid MODE "${raw}". Must be one of: api, indexer, worker`);
}

export const config = {
  /** HTTP RPC endpoint. */
  rpcUrl: optional("RPC_URL", "https://api.devnet.solana.com"),

  /** WebSocket RPC endpoint for log subscriptions. */
  rpcWsUrl: optional("RPC_WS_URL", "wss://api.devnet.solana.com"),

  /** sss-token program ID (base58). */
  programId: optional("PROGRAM_ID", "VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB"),

  /** sss-transfer-hook program ID (base58). */
  transferHookProgramId: optional(
    "TRANSFER_HOOK_PROGRAM_ID",
    "5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV"
  ),

  /** Absolute path to the SQLite database file. */
  dbPath: optional("DB_PATH", "/data/sss.db"),

  /** Express listen port. */
  port: optionalInt("PORT", 3000),

  /** Bearer token that authenticates admin routes. */
  adminApiKey: optional("ADMIN_API_KEY", ""),

  /** Operating mode for this process instance. */
  mode: parseMode(optional("MODE", "api")),

  /** Comma-separated config pubkeys to watch; empty means watch all. */
  watchConfigs: (process.env["WATCH_CONFIGS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** HMAC key for signing outgoing webhook payloads. */
  webhookSecretKey: optional("WEBHOOK_SECRET_KEY", ""),

  /** Maximum concurrent webhook HTTP deliveries. */
  webhookConcurrency: optionalInt("WEBHOOK_CONCURRENCY", 5),

  /** Milliseconds between delivery queue sweeps. */
  webhookPollIntervalMs: optionalInt("WEBHOOK_POLL_INTERVAL_MS", 2000),

  /** Pino log level. */
  logLevel: optional("LOG_LEVEL", "info"),

  /** Enable pretty-printing (dev only). */
  logPretty: optionalBool("LOG_PRETTY", false),

  /** Node environment. */
  nodeEnv: optional("NODE_ENV", "production"),
} as const;

export type Config = typeof config;

// Validate that admin key is set when running as API in production
if (config.mode === "api" && config.nodeEnv === "production" && !config.adminApiKey) {
  process.stderr.write("[config] WARNING: ADMIN_API_KEY is not set; admin endpoints are unprotected\n");
}

export default config;
