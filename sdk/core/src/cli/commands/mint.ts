import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerMint(program: Command): void {
  program
    .command("mint")
    .description("Mint tokens to a recipient")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--amount <amount>", "Amount of tokens to mint (in base units)")
    .option(
      "--recipient <pubkey>",
      "Recipient wallet address (defaults to signer wallet)"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const amount = new BN(opts.amount);
        const recipient = opts.recipient
          ? new PublicKey(opts.recipient)
          : ctx.wallet.publicKey;

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const sig = await stablecoin.mintTokens(ctx.wallet, recipient, amount);

        output(ctx, {
          status: "success",
          signature: sig,
          amount: opts.amount,
          recipient: recipient.toBase58(),
          mint: stablecoin.mint.toBase58(),
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });
}

function requireProgramId(ctx: ReturnType<typeof buildContext>): PublicKey {
  if (!ctx.programId) {
    throw new Error(
      "Program ID is required. Use --program-id"
    );
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
