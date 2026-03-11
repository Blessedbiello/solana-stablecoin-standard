#!/usr/bin/env node
/**
 * SSS Admin Dashboard — TUI entry point.
 *
 * Usage:
 *   sss-tui [--cluster localnet|devnet|mainnet] [--config <base58-pubkey>]
 *
 * When --config is omitted or the cluster is unreachable the dashboard
 * renders using realistic mock data so it can be evaluated without a
 * running validator.
 */

import * as blessed from "blessed";
import { Connection, PublicKey } from "@solana/web3.js";
import { Dashboard } from "./dashboard";
import { getMockData, fetchLiveData } from "./data";
import type { DashboardData, ClusterName } from "./data";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  cluster: ClusterName;
  configAddress: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    cluster: "localnet",
    configAddress: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--cluster" || arg === "-c") && argv[i + 1]) {
      const val = argv[++i].toLowerCase();
      if (val === "devnet" || val === "mainnet" || val === "localnet") {
        args.cluster = val as ClusterName;
      } else {
        console.error(`Unknown cluster: ${val}. Using localnet.`);
      }
    } else if ((arg === "--config" || arg === "-k") && argv[i + 1]) {
      args.configAddress = argv[++i];
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Cluster RPC endpoints
// ---------------------------------------------------------------------------

const CLUSTER_URLS: Record<ClusterName, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

// ---------------------------------------------------------------------------
// SSS token program ID — matches Anchor.toml / target/idl deployment
// Placeholder: replace with the actual deployed program ID.
// ---------------------------------------------------------------------------
const SSS_PROGRAM_ID = new PublicKey(
  "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // ----- blessed screen setup --------------------------------------------
  const screen = blessed.screen({
    smartCSR: true,
    title: "SSS Admin Dashboard",
    dockBorders: true,
    fullUnicode: true,
    forceUnicode: true,
  });

  // Graceful exit helper
  function quit(): void {
    screen.destroy();
    process.exit(0);
  }

  // Global key bindings
  screen.key(["q", "Q", "escape"], quit);
  screen.key(["C-c"], quit);

  // ----- Dashboard instantiation -----------------------------------------
  const dashboard = new Dashboard(screen, args.cluster);
  dashboard.renderLoading();

  // ----- Connection + data fetch -----------------------------------------
  const connection = new Connection(CLUSTER_URLS[args.cluster], "confirmed");

  let lastData: DashboardData | null = null;

  async function refresh(): Promise<void> {
    let data: DashboardData;

    if (args.configAddress) {
      let configPubkey: PublicKey;
      try {
        configPubkey = new PublicKey(args.configAddress);
      } catch {
        dashboard.renderError(
          `Invalid config address: ${args.configAddress}`
        );
        data = getMockData();
        lastData = data;
        dashboard.render(data);
        return;
      }

      data = await fetchLiveData(connection, SSS_PROGRAM_ID, configPubkey);
    } else {
      // No config address provided — use mock data for demo mode
      data = getMockData();
    }

    lastData = data;
    dashboard.render(data);
  }

  // Tab cycles focus between panels
  screen.key(["tab"], () => {
    dashboard.focusNext();
  });

  // r or R triggers a manual refresh
  screen.key(["r", "R"], () => {
    if (lastData) {
      // Re-render the loading state briefly before the async fetch
      dashboard.renderLoading();
    }
    refresh().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      dashboard.renderError(message);
    });
  });

  // Handle terminal resize — blessed handles it automatically, but we
  // re-render our content to reflow properly.
  screen.on("resize", () => {
    if (lastData) {
      dashboard.render(lastData);
    }
  });

  // Initial data load
  await refresh();

  // Auto-refresh every 30 seconds when connected to a real cluster
  if (args.configAddress) {
    const REFRESH_INTERVAL_MS = 30_000;
    setInterval(() => {
      refresh().catch(() => {
        // Errors are surfaced in the status bar by fetchLiveData itself
      });
    }, REFRESH_INTERVAL_MS);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});
