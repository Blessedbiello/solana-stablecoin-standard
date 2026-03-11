import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerPause(program: Command): void {
  program
    .command("pause")
    .description("Pause or unpause a stablecoin (requires Pauser role)")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .option("--unpause", "Unpause instead of pausing", false)
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        let sig: string;
        let newState: string;

        if (opts.unpause) {
          sig = await stablecoin.unpause(ctx.wallet);
          newState = "active";
        } else {
          sig = await stablecoin.pause(ctx.wallet);
          newState = "paused";
        }

        output(ctx, {
          status: "success",
          signature: sig,
          state: newState,
          config: opts.config,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });
}

function requireProgramId(ctx: ReturnType<typeof buildContext>): PublicKey {
  if (!ctx.programId) {
    throw new Error("Program ID is required. Use --program-id");
  }
  return new PublicKey(ctx.programId);
}

async function loadProgram(provider: any, programId: PublicKey): Promise<Program> {
  try {
    return await Program.at(programId, provider);
  } catch {
    throw new Error(
      `Could not load program IDL for ${programId.toBase58()}. Ensure the program is deployed.`
    );
  }
}
