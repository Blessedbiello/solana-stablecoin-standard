import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";

export function registerBlacklist(program: Command): void {
  const blacklist = program
    .command("blacklist")
    .description("Blacklist management (add, remove, check)");

  // blacklist add
  blacklist
    .command("add")
    .description("Add an address to the blacklist (requires Blacklister role)")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--address <pubkey>", "Address to blacklist")
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const targetAddress = new PublicKey(opts.address);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const accounts = stablecoin.compliance.buildBlacklistAddAccounts(
          ctx.wallet.publicKey,
          targetAddress
        );

        // Override systemProgram with correct value
        const fixedAccounts = {
          ...accounts,
          systemProgram: SystemProgram.programId,
        };

        const sig = await anchorProgram.methods
          .blacklistAdd()
          .accounts(fixedAccounts as any)
          .signers([ctx.wallet])
          .rpc();

        output(ctx, {
          status: "success",
          signature: sig,
          action: "add",
          address: opts.address,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });

  // blacklist remove
  blacklist
    .command("remove")
    .description(
      "Remove an address from the blacklist (requires Blacklister role)"
    )
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--address <pubkey>", "Address to remove from blacklist")
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const targetAddress = new PublicKey(opts.address);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const accounts = stablecoin.compliance.buildBlacklistRemoveAccounts(
          ctx.wallet.publicKey,
          targetAddress
        );

        const sig = await anchorProgram.methods
          .blacklistRemove()
          .accounts(accounts as any)
          .signers([ctx.wallet])
          .rpc();

        output(ctx, {
          status: "success",
          signature: sig,
          action: "remove",
          address: opts.address,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });

  // blacklist check
  blacklist
    .command("check")
    .description("Check whether an address is blacklisted")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--address <pubkey>", "Address to check")
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const targetAddress = new PublicKey(opts.address);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const isBlacklisted =
          await stablecoin.compliance.isBlacklisted(targetAddress);

        const data: Record<string, string | boolean | null> = {
          address: opts.address,
          blacklisted: isBlacklisted,
          blacklistedBy: null,
          blacklistedAt: null,
        };

        if (isBlacklisted) {
          const entry =
            await stablecoin.compliance.getBlacklistEntry(targetAddress);
          if (entry) {
            data.blacklistedBy = entry.blacklistedBy.toBase58();
            data.blacklistedAt = entry.createdAt.toString();
          }
        }

        output(ctx, data);
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
