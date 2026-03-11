import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerSeize(program: Command): void {
  program
    .command("seize")
    .description(
      "Seize tokens from a frozen account into treasury (requires Seizer role)"
    )
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption(
      "--from <pubkey>",
      "Wallet address whose tokens will be seized"
    )
    .option(
      "--hook-program <pubkey>",
      "Transfer hook program ID (required if stablecoin uses a transfer hook)"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const sourceOwner = new PublicKey(opts.from);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const configData = await stablecoin.getConfig();
        const sourceTokenAccount = stablecoin.getTokenAccount(sourceOwner);

        const hookProgramId = opts.hookProgram
          ? new PublicKey(opts.hookProgram)
          : undefined;

        // Determine treasury owner — the treasury is stored on config
        const treasuryOwner = configData.treasury;

        const accounts = stablecoin.compliance.buildSeizeAccounts(
          ctx.wallet.publicKey,
          stablecoin.mint,
          sourceTokenAccount,
          configData.treasury,
          TOKEN_2022_PROGRAM_ID
        );

        const remainingAccounts = hookProgramId
          ? stablecoin.compliance.getSeizeRemainingAccounts(
              stablecoin.mint,
              sourceOwner,
              // Treasury owner for dest blacklist check (seizer sends to treasury)
              ctx.wallet.publicKey
            )
          : [];

        const sig = await anchorProgram.methods
          .seizeTokens()
          .accounts(accounts as any)
          .remainingAccounts(remainingAccounts)
          .signers([ctx.wallet])
          .rpc();

        output(ctx, {
          status: "success",
          signature: sig,
          seized: opts.from,
          sourceTokenAccount: sourceTokenAccount.toBase58(),
          treasury: configData.treasury.toBase58(),
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
