import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";
import { presetToString } from "../../presets";
import { Preset } from "../../types";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show the current status of a stablecoin")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
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

        const data = {
          config: configPubkey.toBase58(),
          mint: stablecoin.mint.toBase58(),
          authority: config.masterAuthority.toBase58(),
          pendingAuthority:
            config.pendingAuthority.equals(PublicKey.default)
              ? null
              : config.pendingAuthority.toBase58(),
          preset: presetToString(config.preset as Preset),
          decimals: config.decimals,
          paused: config.paused,
          totalMinted: config.totalMinted.toString(),
          totalBurned: config.totalBurned.toString(),
          supply: supply.toString(),
          cluster: ctx.cluster,
        };

        if (ctx.jsonOutput) {
          output(ctx, data);
        } else {
          console.log("");
          console.log(`Stablecoin Status`);
          console.log(`=================`);
          console.log(`Config:           ${data.config}`);
          console.log(`Mint:             ${data.mint}`);
          console.log(`Authority:        ${data.authority}`);
          if (data.pendingAuthority) {
            console.log(`Pending Auth:     ${data.pendingAuthority}`);
          }
          console.log(`Preset:           ${data.preset}`);
          console.log(`Decimals:         ${data.decimals}`);
          console.log(`Paused:           ${data.paused}`);
          console.log(`Total Minted:     ${data.totalMinted}`);
          console.log(`Total Burned:     ${data.totalBurned}`);
          console.log(`Supply:           ${data.supply}`);
          console.log(`Cluster:          ${data.cluster}`);
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
