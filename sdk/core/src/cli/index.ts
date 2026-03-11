#!/usr/bin/env node

import { Command } from "commander";
import { DEFAULT_WALLET_PATH, DEFAULT_CLUSTER } from "./config";
import { registerInit } from "./commands/init";
import { registerMint } from "./commands/mint";
import { registerBurn } from "./commands/burn";
import { registerFreeze } from "./commands/freeze";
import { registerThaw } from "./commands/thaw";
import { registerPause } from "./commands/pause";
import { registerStatus } from "./commands/status";
import { registerSupply } from "./commands/supply";
import { registerRoles } from "./commands/roles";
import { registerBlacklist } from "./commands/blacklist";
import { registerSeize } from "./commands/seize";

const program = new Command();

program
  .name("sss-token")
  .description("CLI for the Solana Stablecoin Standard (SSS)")
  .version("0.1.0")
  // Global options inherited by all sub-commands via optsWithGlobals()
  .option(
    "--cluster <cluster>",
    "Solana cluster: devnet | mainnet | localnet",
    DEFAULT_CLUSTER
  )
  .option(
    "--wallet <path>",
    "Path to wallet keypair JSON file",
    DEFAULT_WALLET_PATH
  )
  .option(
    "--program-id <pubkey>",
    "SSS token program ID (overrides SSS_PROGRAM_ID env var)"
  )
  .option("--json", "Output results as JSON", false);

// Resolve --program-id from environment if not passed explicitly
program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = program.opts();
  if (!opts.programId && process.env.SSS_PROGRAM_ID) {
    opts.programId = process.env.SSS_PROGRAM_ID;
  }
});

// Register all sub-commands
registerInit(program);
registerMint(program);
registerBurn(program);
registerFreeze(program);
registerThaw(program);
registerPause(program);
registerStatus(program);
registerSupply(program);
registerRoles(program);
registerBlacklist(program);
registerSeize(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Fatal: ${message}`);
  process.exit(1);
});
