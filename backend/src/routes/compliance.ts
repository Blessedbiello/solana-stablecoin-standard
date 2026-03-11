/**
 * Compliance routes — blacklist management and audit log access.
 *
 * All endpoints require Authorization: Bearer <ADMIN_API_KEY>.
 */

import { Router, Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";
import config from "../config.js";
import logger from "../logger.js";
import {
  getBlacklistedAddresses,
  getAuditLog,
  hashReason,
} from "../services/compliance.js";
import { insertAuditLog } from "../db/index.js";

export const complianceRouter = Router();

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidPublicKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function actorFromRequest(req: Request): string {
  const authHeader = req.headers["authorization"] ?? "";
  // Use a truncated token as the actor label so we never log the full key
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "anonymous";
  return token.length > 8 ? `apikey:${token.slice(0, 8)}...` : "anonymous";
}

// ── POST /api/v1/compliance/blacklist ─────────────────────────────────────────

complianceRouter.post("/blacklist", requireApiKey, async (req: Request, res: Response) => {
  const { address, config: configPda, authority, config_id, reason } = req.body as Record<string, unknown>;

  if (!isValidPublicKey(address)) {
    res.status(400).json({ error: "'address' must be a valid Solana public key" });
    return;
  }
  if (configPda !== undefined && !isValidPublicKey(configPda)) {
    res.status(400).json({ error: "'config' must be a valid Solana public key" });
    return;
  }

  const reasonStr = typeof reason === "string" && reason.trim() ? reason.trim() : "No reason provided";
  const reasonHash = Buffer.from(hashReason(reasonStr)).toString("hex");

  // Record the intent in the audit log immediately; actual on-chain submission
  // is a responsibility of the caller (they hold the signer keypair).
  const actor = actorFromRequest(req);

  try {
    const auditId = insertAuditLog({
      action: "blacklist_add_request",
      actor,
      target: typeof address === "string" ? address : undefined,
      details: {
        address,
        config: configPda ?? null,
        authority: authority ?? null,
        config_id: config_id ?? null,
        reason: reasonStr,
        reason_hash: reasonHash,
      },
    });

    logger.info({ address, actor, auditId }, "Blacklist add request recorded");

    res.status(202).json({
      message: "Blacklist request recorded. Submit the on-chain transaction to finalise.",
      audit_id: auditId,
      address,
      reason_hash: reasonHash,
      // Return instruction hints so the client can build the transaction
      instruction_hint: {
        program_id: config.programId,
        seeds: ["blacklist", configPda ?? "<config_pda>", address],
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to record blacklist request");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/v1/compliance/blacklist/:address ──────────────────────────────

complianceRouter.delete("/blacklist/:address", requireApiKey, async (req: Request, res: Response) => {
  const { address } = req.params;
  const { config: configPda, authority, config_id } = req.query;

  if (!isValidPublicKey(address)) {
    res.status(400).json({ error: "':address' must be a valid Solana public key" });
    return;
  }

  const actor = actorFromRequest(req);

  try {
    const auditId = insertAuditLog({
      action: "blacklist_remove_request",
      actor,
      target: address,
      details: {
        address,
        config: configPda ?? null,
        authority: authority ?? null,
        config_id: config_id ?? null,
      },
    });

    logger.info({ address, actor, auditId }, "Blacklist remove request recorded");

    res.json({
      message: "Blacklist removal request recorded. Submit the on-chain transaction to finalise.",
      audit_id: auditId,
      address,
    });
  } catch (err) {
    logger.error({ err }, "Failed to record blacklist removal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/v1/compliance/blacklist ─────────────────────────────────────────

complianceRouter.get("/blacklist", requireApiKey, (req: Request, res: Response) => {
  const { config: configPda } = req.query;

  if (configPda !== undefined && !isValidPublicKey(configPda)) {
    res.status(400).json({ error: "Invalid 'config' query parameter" });
    return;
  }

  try {
    const entries = getBlacklistedAddresses(
      isValidPublicKey(configPda) ? configPda : undefined
    );

    res.json({
      count: entries.length,
      blacklist: entries,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch blacklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/v1/compliance/audit ──────────────────────────────────────────────

complianceRouter.get("/audit", requireApiKey, (req: Request, res: Response) => {
  const { actor, action, limit: limitQ, offset: offsetQ } = req.query;

  const limit = Math.min(Math.max(parseInt(String(limitQ ?? "50"), 10) || 50, 1), 500);
  const offset = Math.max(parseInt(String(offsetQ ?? "0"), 10) || 0, 0);

  try {
    const entries = getAuditLog({
      actor: typeof actor === "string" ? actor : undefined,
      action: typeof action === "string" ? action : undefined,
      limit,
      offset,
    });

    res.json({
      count: entries.length,
      limit,
      offset,
      audit: entries,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch audit log");
    res.status(500).json({ error: "Internal server error" });
  }
});
