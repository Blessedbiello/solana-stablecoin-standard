import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { buildContext, output, handleError } from "../config";
import { SolanaStablecoin } from "../../stablecoin";
import { Role } from "../../types";

const ROLE_NAMES: Record<string, Role> = {
  minter: Role.Minter,
  burner: Role.Burner,
  blacklister: Role.Blacklister,
  pauser: Role.Pauser,
  seizer: Role.Seizer,
  "freeze-auth": Role.FreezeAuth,
  freezeauth: Role.FreezeAuth,
};

const ROLE_LABELS: Record<number, string> = {
  [Role.Minter]: "Minter",
  [Role.Burner]: "Burner",
  [Role.Blacklister]: "Blacklister",
  [Role.Pauser]: "Pauser",
  [Role.Seizer]: "Seizer",
  [Role.FreezeAuth]: "FreezeAuth",
};

function parseRole(value: string): Role {
  const normalized = value.toLowerCase().replace(/[-_\s]/g, "");
  const role = ROLE_NAMES[value.toLowerCase()] ?? ROLE_NAMES[normalized];
  if (role === undefined) {
    throw new Error(
      `Unknown role "${value}". Valid roles: minter, burner, blacklister, pauser, seizer, freeze-auth`
    );
  }
  return role;
}

export function registerRoles(program: Command): void {
  const roles = program
    .command("roles")
    .description("Role management (assign, revoke, check)");

  // roles assign
  roles
    .command("assign")
    .description("Assign a role to an address (requires authority)")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--holder <pubkey>", "Address to assign the role to")
    .requiredOption(
      "--role <role>",
      "Role to assign: minter | burner | blacklister | pauser | seizer | freeze-auth"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const holderPubkey = new PublicKey(opts.holder);
        const role = parseRole(opts.role);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const sig = await stablecoin.assignRole(ctx.wallet, holderPubkey, role);

        output(ctx, {
          status: "success",
          signature: sig,
          action: "assign",
          role: ROLE_LABELS[role],
          holder: opts.holder,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });

  // roles revoke
  roles
    .command("revoke")
    .description("Revoke a role from an address (requires authority)")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--holder <pubkey>", "Address to revoke the role from")
    .requiredOption(
      "--role <role>",
      "Role to revoke: minter | burner | blacklister | pauser | seizer | freeze-auth"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const holderPubkey = new PublicKey(opts.holder);
        const role = parseRole(opts.role);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const sig = await stablecoin.revokeRole(ctx.wallet, holderPubkey, role);

        output(ctx, {
          status: "success",
          signature: sig,
          action: "revoke",
          role: ROLE_LABELS[role],
          holder: opts.holder,
        });
      } catch (err) {
        handleError(err, ctx.jsonOutput);
      }
    });

  // roles check
  roles
    .command("check")
    .description("Check whether an address holds a role")
    .requiredOption("--config <pubkey>", "Stablecoin config account address")
    .requiredOption("--holder <pubkey>", "Address to check")
    .requiredOption(
      "--role <role>",
      "Role to check: minter | burner | blacklister | pauser | seizer | freeze-auth"
    )
    .action(async (opts) => {
      const globals = program.optsWithGlobals();
      const ctx = buildContext(globals);

      try {
        const configPubkey = new PublicKey(opts.config);
        const holderPubkey = new PublicKey(opts.holder);
        const role = parseRole(opts.role);

        const programId = requireProgramId(ctx);
        const anchorProgram = await loadProgram(ctx.provider, programId);
        const stablecoin = await SolanaStablecoin.load(
          anchorProgram,
          ctx.provider,
          configPubkey
        );

        const hasRole = await stablecoin.hasRole(holderPubkey, role);

        output(ctx, {
          holder: opts.holder,
          role: ROLE_LABELS[role],
          hasRole,
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
