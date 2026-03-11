import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerFreeze(program: Command): void {
  program
    .command("freeze")
    .description("Freeze a token account (requires FreezeAuth role)")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption(
      "--address <pubkey>",
      "Wallet address whose token account will be frozen"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const targetWallet = new PublicKey(opts.address);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const tokenAccount = stablecoin.getTokenAccount(targetWallet);
        const sig = await stablecoin.freezeAccount(ctx.wallet, tokenAccount);

        output(ctx, {
          status: "success",
          signature: sig,
          frozen: opts.address,
          tokenAccount: tokenAccount.toBase58(),
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
