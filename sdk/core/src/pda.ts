import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Role } from "./types";

export const CONFIG_SEED = Buffer.from("stablecoin_config");
export const MINT_SEED = Buffer.from("sss_mint");
export const MINTER_SEED = Buffer.from("minter_info");
export const ROLE_SEED = Buffer.from("role");
export const BLACKLIST_SEED = Buffer.from("blacklist");
export const ALLOWLIST_SEED = Buffer.from("allowlist");
export const ORACLE_SEED = Buffer.from("oracle_config");
export const HOOK_CONFIG_SEED = Buffer.from("hook_config");
export const EXTRA_METAS_SEED = Buffer.from("extra-account-metas");

export function findConfigPda(
  programId: PublicKey,
  authority: PublicKey,
  configId: number | BN
): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  const id = typeof configId === "number" ? BigInt(configId) : BigInt(configId.toString());
  idBuf.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, authority.toBuffer(), idBuf],
    programId
  );
}

export function findMintPda(
  programId: PublicKey,
  config: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINT_SEED, config.toBuffer()],
    programId
  );
}

export function findMinterPda(
  programId: PublicKey,
  config: PublicKey,
  minter: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    programId
  );
}

export function findRolePda(
  programId: PublicKey,
  config: PublicKey,
  holder: PublicKey,
  role: Role
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ROLE_SEED, config.toBuffer(), holder.toBuffer(), Buffer.from([role])],
    programId
  );
}

export function findBlacklistPda(
  programId: PublicKey,
  config: PublicKey,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
    programId
  );
}

export function findAllowlistPda(
  programId: PublicKey,
  config: PublicKey,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ALLOWLIST_SEED, config.toBuffer(), address.toBuffer()],
    programId
  );
}

export function findOracleConfigPda(
  programId: PublicKey,
  config: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_SEED, config.toBuffer()],
    programId
  );
}

export function findHookConfigPda(
  hookProgramId: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOOK_CONFIG_SEED, mint.toBuffer()],
    hookProgramId
  );
}

export function findExtraMetasPda(
  hookProgramId: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_METAS_SEED, mint.toBuffer()],
    hookProgramId
  );
}
