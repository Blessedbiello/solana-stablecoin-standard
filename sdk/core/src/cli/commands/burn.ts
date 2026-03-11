import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerBurn(program: Command): void {
  program
    .command("burn")
    .description("Burn tokens from the signer's token account")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--amount <amount>", "Amount of tokens to burn (in base units)")
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const amount = new BN(opts.amount);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const sig = await stablecoin.burnTokens(ctx.wallet, amount);

        output(ctx, {
          status: "success",
          signature: sig,
          amount: opts.amount,
          burner: ctx.wallet.publicKey.toBase58(),
          mint: stablecoin.mint.toBase58(),
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
