import { Connection } from "@solana/web3.js";
import { getDb } from "./db/index.js";
import config from "./config.js";
import logger from "./logger.js";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  uptime: number;
  checks: {
    database: CheckResult;
    solana: CheckResult;
  };
  version: string;
  mode: string;
}

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

const startTime = Date.now();
const VERSION = "1.0.0";

/** Check SQLite database connectivity. */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Health check: database failed");
    return { ok: false, latencyMs: Date.now() - start, error: message };
  }
}

/** Check Solana RPC connectivity by fetching the current slot. */
async function checkSolana(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const connection = new Connection(config.rpcUrl, "confirmed");
    await connection.getSlot();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Health check: Solana RPC failed");
    return { ok: false, latencyMs: Date.now() - start, error: message };
  }
}

/**
 * Run all health checks and return a consolidated status object.
 * Does not throw — individual check errors are captured in the response.
 */
export async function getHealth(): Promise<HealthStatus> {
  const [database, solana] = await Promise.all([checkDatabase(), checkSolana()]);

  const allOk = database.ok && solana.ok;
  const anyOk = database.ok || solana.ok;

  return {
    status: allOk ? "ok" : anyOk ? "degraded" : "down",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: { database, solana },
    version: VERSION,
    mode: config.mode,
  };
}
