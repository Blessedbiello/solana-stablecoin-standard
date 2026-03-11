import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerSupply(program: Command): void {
  program
    .command("supply")
    .description("Show supply information for a stablecoin")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .option(
      "--balance-of <pubkey>",
      "Also show token balance for this wallet address"
    )
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

        const config = await stablecoin.getConfig();
        const supply = config.totalMinted.sub(config.totalBurned);

        const data: Record<string, string | number | null> = {
          mint: stablecoin.mint.toBase58(),
          decimals: config.decimals,
          totalMinted: config.totalMinted.toString(),
          totalBurned: config.totalBurned.toString(),
          circulatingSupply: supply.toString(),
        };

        if (opts.balanceOf) {
          const ownerPubkey = new PublicKey(opts.balanceOf);
          const balance = await stablecoin.getBalance(ownerPubkey);
          data["balanceOf"] = balance.toString();
          data["balanceOfWallet"] = opts.balanceOf;
        }

        if (ctx.jsonOutput) {
          output(ctx, data);
        } else {
          console.log("");
          console.log(`Supply Info`);
          console.log(`===========`);
          console.log(`Mint:               ${data.mint}`);
          console.log(`Decimals:           ${data.decimals}`);
          console.log(`Total Minted:       ${data.totalMinted}`);
          console.log(`Total Burned:       ${data.totalBurned}`);
          console.log(`Circulating Supply: ${data.circulatingSupply}`);
          if (opts.balanceOf) {
            console.log(`Balance of ${data.balanceOfWallet}: ${data.balanceOf}`);
          }
          console.log("");
        }
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
