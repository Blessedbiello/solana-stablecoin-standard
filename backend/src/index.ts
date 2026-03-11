/**
 * Main entry point.
 *
 * Behaviour is controlled by the MODE environment variable:
 *
 *   MODE=api      — Start the Express HTTP server (default)
 *   MODE=indexer  — Start the Solana log subscription listener
 *   MODE=worker   — Start the webhook delivery worker
 *
 * In all modes the SQLite database is initialised first so that the schema
 * exists before any reads or writes.
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import config from "./config.js";
import logger from "./logger.js";
import { initDb, closeDb } from "./db/index.js";
import { adminRouter } from "./routes/admin.js";
import { complianceRouter } from "./routes/compliance.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { startEventListener, stopEventListener } from "./services/event-listener.js";
import { startWebhookWorker, stopWebhookWorker } from "./services/webhook.js";

// ── Database ──────────────────────────────────────────────────────────────────

try {
  initDb();
} catch (err) {
  logger.fatal({ err }, "Failed to initialise database");
  process.exit(1);
}

// ── API server ────────────────────────────────────────────────────────────────

function createApp(): express.Application {
  const app = express();

  // Body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // Request logging (skip health endpoint to reduce noise)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path !== "/health") {
      logger.debug({ method: req.method, path: req.path, ip: req.ip }, "Incoming request");
    }
    next();
  });

  // Liveness probe (no auth required)
  app.get("/health", async (_req: Request, res: Response) => {
    const { getHealth } = await import("./health.js");
    try {
      const health = await getHealth();
      const code = health.status === "ok" ? 200 : health.status === "degraded" ? 207 : 503;
      res.status(code).json(health);
    } catch {
      res.status(503).json({ status: "down" });
    }
  });

  // API v1 routes
  app.use("/api/v1", adminRouter);
  app.use("/api/v1/compliance", complianceRouter);
  app.use("/api/v1/webhooks", webhooksRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "Unhandled request error");
    res.status(500).json({ error: message });
  });

  return app;
}

// ── Mode dispatch ─────────────────────────────────────────────────────────────

async function startApi(): Promise<void> {
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, mode: "api" }, "SSS API server listening");
  });

  // Also start the indexer in the same process if no separate indexer container
  // is detected (determined by the absence of a dedicated indexer MODE).
  // In Docker Compose the indexer runs as a separate container so we skip here.
  // Set START_INDEXER_WITH_API=true to embed it.
  if (process.env["START_INDEXER_WITH_API"] === "true") {
    logger.info("Starting embedded indexer alongside API");
    await startEventListener();
  }

  return new Promise((resolve) => {
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");
      server.close(async () => {
        await stopEventListener();
        stopWebhookWorker();
        closeDb();
        logger.info("Graceful shutdown complete");
        resolve();
        process.exit(0);
      });
    };

    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
  });
}

async function startIndexer(): Promise<void> {
  logger.info({ mode: "indexer", programId: config.programId }, "Starting indexer");

  await startEventListener();

  // Keep the process alive
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await stopEventListener();
    closeDb();
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  // Block indefinitely
  await new Promise<never>(() => {
    // The WebSocket subscription keeps the event loop alive naturally.
    // This promise is intentionally never resolved.
  });
}

async function startWorker(): Promise<void> {
  logger.info({ mode: "worker" }, "Starting webhook delivery worker");

  startWebhookWorker();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    stopWebhookWorker();
    closeDb();
    process.exit(0);
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  // Block indefinitely (the timer keeps the event loop alive)
  await new Promise<never>(() => {
    // Intentionally unresolved
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    switch (config.mode) {
      case "api":
        await startApi();
        break;
      case "indexer":
        await startIndexer();
        break;
      case "worker":
        await startWorker();
        break;
    }
  } catch (err) {
    logger.fatal({ err }, "Fatal startup error");
    process.exit(1);
  }
})();
