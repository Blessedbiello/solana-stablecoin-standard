import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";
import { presetFromString, presetToString } from "../../presets";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .requiredOption("--name <name>", "Token name (e.g. USD Stablecoin)")
    .requiredOption("--symbol <symbol>", "Token symbol (e.g. USDS)")
    .option(
      "--preset <preset>",
      "Preset: sss-1 (minimal), sss-2 (compliant), sss-3 (private)",
      "sss-1"
    )
    .option("--decimals <decimals>", "Token decimals", "6")
    .option("--uri <uri>", "Metadata URI", "")
    .option("--config-id <id>", "Config account ID (u64)", "0")
    .option(
      "--hook-program <pubkey>",
      "Transfer hook program ID (required for sss-2 and sss-3)"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const preset = presetFromString(opts.preset);
        const decimals = parseInt(opts.decimals, 10);
        const configId = parseInt(opts.configId, 10);

        if (isNaN(decimals) || decimals < 0 || decimals > 9) {
          throw new Error("Decimals must be an integer between 0 and 9");
        }

        if (isNaN(configId) || configId < 0) {
          throw new Error("Config ID must be a non-negative integer");
        }

        const programId = ctx.programId
          ? new PublicKey(ctx.programId)
          : undefined;

        if (!programId) {
          throw new Error(
            "Program ID is required. Use --program-id or set SSS_PROGRAM_ID env var"
          );
        }

        let hookProgramId: PublicKey | undefined;
        if (opts.hookProgram) {
          hookProgramId = new PublicKey(opts.hookProgram);
        }

        // Load the anchor IDL and build the program instance
        const anchorProgram = await loadProgram(ctx.provider, programId);

        const stablecoin = await SolanaStablecoin.create(
          anchorProgram,
          ctx.provider,
          {
            authority: ctx.wallet,
            configId,
            preset,
            decimals,
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri ?? "",
            hookProgramId,
          }
        );

        output(ctx, {
          status: "success",
          config: stablecoin.config.toBase58(),
          mint: stablecoin.mint.toBase58(),
          preset: presetToString(preset),
          name: opts.name,
          symbol: opts.symbol,
          decimals,
          cluster: ctx.cluster,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });
}

async function loadProgram(provider: any, programId: PublicKey): Promise<Program> {
  // Attempt to load IDL from the chain; fall back to local IDL if available
  try {
    return await Program.at(programId, provider);
  } catch {
    throw new Error(
      `Could not load program IDL for ${programId.toBase58()}.\n` +
        `Ensure the program is deployed and its IDL is available on-chain, or run 'anchor build' first.`
    );
  }
}
