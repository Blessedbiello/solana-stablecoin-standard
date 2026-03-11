/**
 * Admin routes — stablecoin operations and monitoring.
 *
 * All mutation endpoints (mint, burn, freeze, thaw) require a valid
 * Authorization: Bearer <ADMIN_API_KEY> header.
 */

import { Router, Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";
import config from "../config.js";
import logger from "../logger.js";
import { getHealth } from "../health.js";
import { queryEvents } from "../db/index.js";
import { getSupplyInfo, getHolders } from "../services/mint-burn.js";

export const adminRouter = Router();

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminApiKey) {
    // Not configured — allow (with a warning already emitted at startup)
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

// ── Validators ────────────────────────────────────────────────────────────────

function isValidPublicKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function parsePaginationParams(req: Request): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(String(req.query["limit"] ?? "50"), 10) || 50, 1), 500);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"), 10) || 0, 0);
  return { limit, offset };
}

// ── GET /api/v1/health ────────────────────────────────────────────────────────

adminRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = await getHealth();
    const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 207 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    logger.error({ err }, "Health check failed");
    res.status(503).json({ error: "Health check failed" });
  }
});

// ── GET /api/v1/status ────────────────────────────────────────────────────────

adminRouter.get("/status", requireApiKey, async (_req: Request, res: Response) => {
  try {
    const health = await getHealth();
    res.json({
      ok: health.status !== "down",
      ...health,
    });
  } catch (err) {
    logger.error({ err }, "Status endpoint failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/v1/supply ────────────────────────────────────────────────────────

adminRouter.get("/supply", requireApiKey, async (req: Request, res: Response) => {
  const { config: configPda } = req.query;

  if (!isValidPublicKey(configPda)) {
    res.status(400).json({ error: "Query parameter 'config' must be a valid public key" });
    return;
  }

  try {
    const supply = await getSupplyInfo(configPda);
    res.json({ config: configPda, ...supply });
  } catch (err) {
    logger.error({ err, configPda }, "Failed to fetch supply");
    res.status(502).json({ error: "Failed to fetch on-chain supply" });
  }
});

// ── GET /api/v1/holders ───────────────────────────────────────────────────────

adminRouter.get("/holders", requireApiKey, async (req: Request, res: Response) => {
  const { config: configPda } = req.query;

  if (!isValidPublicKey(configPda)) {
    res.status(400).json({ error: "Query parameter 'config' must be a valid public key" });
    return;
  }

  try {
    const holders = await getHolders(configPda);
    res.json({ config: configPda, count: holders.length, holders });
  } catch (err) {
    logger.error({ err, configPda }, "Failed to fetch holders");
    res.status(502).json({ error: "Failed to fetch holder accounts" });
  }
});

// ── GET /api/v1/events ────────────────────────────────────────────────────────

adminRouter.get("/events", requireApiKey, (req: Request, res: Response) => {
  const { config: configPda, event_type, since_slot } = req.query;
  const { limit, offset } = parsePaginationParams(req);

  if (configPda !== undefined && !isValidPublicKey(configPda)) {
    res.status(400).json({ error: "Invalid 'config' query parameter" });
    return;
  }

  try {
    const events = queryEvents({
      config: isValidPublicKey(configPda) ? configPda : undefined,
      eventType: typeof event_type === "string" ? event_type : undefined,
      sinceSlot: since_slot !== undefined ? parseInt(String(since_slot), 10) : undefined,
      limit,
      offset,
    });

    res.json({ count: events.length, limit, offset, events });
  } catch (err) {
    logger.error({ err }, "Failed to query events");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/v1/mint ─────────────────────────────────────────────────────────

adminRouter.post("/mint", requireApiKey, async (req: Request, res: Response) => {
  const { authority, config_id, minter, recipient, amount } = req.body as Record<string, unknown>;

  if (!isValidPublicKey(authority)) {
    res.status(400).json({ error: "'authority' must be a valid public key" });
    return;
  }
  if (typeof config_id !== "string" && typeof config_id !== "number") {
    res.status(400).json({ error: "'config_id' must be a numeric string or number" });
    return;
  }
  if (!isValidPublicKey(minter)) {
    res.status(400).json({ error: "'minter' must be a valid public key" });
    return;
  }
  if (!isValidPublicKey(recipient)) {
    res.status(400).json({ error: "'recipient' must be a valid public key" });
    return;
  }
  if (typeof amount !== "string" && typeof amount !== "number") {
    res.status(400).json({ error: "'amount' must be a numeric string or number" });
    return;
  }

  // In a production system the signer keypair would come from a KMS vault.
  // Here we return a 501 to indicate the endpoint shape is correct but
  // live transaction signing requires additional setup.
  res.status(501).json({
    error: "not_implemented",
    message:
      "Mint endpoint requires a signer keypair injected via KMS/vault. " +
      "Build the transaction client-side using buildMintInstruction() from the SDK.",
    params: { authority, config_id, minter, recipient, amount },
  });
});

// ── POST /api/v1/burn ─────────────────────────────────────────────────────────

adminRouter.post("/burn", requireApiKey, async (req: Request, res: Response) => {
  const { authority, config_id, burner, burner_token_account, amount } = req.body as Record<string, unknown>;

  if (!isValidPublicKey(authority)) {
    res.status(400).json({ error: "'authority' must be a valid public key" });
    return;
  }
  if (!isValidPublicKey(burner)) {
    res.status(400).json({ error: "'burner' must be a valid public key" });
    return;
  }
  if (!isValidPublicKey(burner_token_account)) {
    res.status(400).json({ error: "'burner_token_account' must be a valid public key" });
    return;
  }
  if (typeof amount !== "string" && typeof amount !== "number") {
    res.status(400).json({ error: "'amount' must be a numeric string or number" });
    return;
  }

  res.status(501).json({
    error: "not_implemented",
    message:
      "Burn endpoint requires a signer keypair. " +
      "Build the transaction client-side using buildBurnInstruction() from the SDK.",
    params: { authority, config_id, burner, burner_token_account, amount },
  });
});

// ── POST /api/v1/freeze ───────────────────────────────────────────────────────

adminRouter.post("/freeze", requireApiKey, async (req: Request, res: Response) => {
  const { authority, config_id, account } = req.body as Record<string, unknown>;

  if (!isValidPublicKey(authority) || !isValidPublicKey(account)) {
    res.status(400).json({ error: "Missing or invalid 'authority' or 'account' public key" });
    return;
  }

  res.status(501).json({
    error: "not_implemented",
    message: "Freeze endpoint requires a FreezeAuth signer keypair from vault.",
    params: { authority, config_id, account },
  });
});

// ── POST /api/v1/thaw ─────────────────────────────────────────────────────────

adminRouter.post("/thaw", requireApiKey, async (req: Request, res: Response) => {
  const { authority, config_id, account } = req.body as Record<string, unknown>;

  if (!isValidPublicKey(authority) || !isValidPublicKey(account)) {
    res.status(400).json({ error: "Missing or invalid 'authority' or 'account' public key" });
    return;
  }

  res.status(501).json({
    error: "not_implemented",
    message: "Thaw endpoint requires a FreezeAuth signer keypair from vault.",
    params: { authority, config_id, account },
  });
});
