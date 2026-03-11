import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SssToken } from "../../target/types/sss_token";
import { SssTransferHook } from "../../target/types/sss_transfer_hook";

export const CONFIG_SEED = Buffer.from("stablecoin_config");
export const MINT_SEED = Buffer.from("sss_mint");
export const MINTER_SEED = Buffer.from("minter_info");
export const ROLE_SEED = Buffer.from("role");
export const BLACKLIST_SEED = Buffer.from("blacklist");
export const ALLOWLIST_SEED = Buffer.from("allowlist");
export const HOOK_CONFIG_SEED = Buffer.from("hook_config");
export const EXTRA_METAS_SEED = Buffer.from("extra-account-metas");

export enum Role {
  Minter = 0,
  Burner = 1,
  Blacklister = 2,
  Pauser = 3,
  Seizer = 4,
  FreezeAuth = 5,
}

export enum Preset {
  Minimal = 1,
  Compliant = 2,
  Private = 3,
}

export function getPrograms() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SssToken as Program<SssToken>;
  const hookProgram = anchor.workspace
    .SssTransferHook as Program<SssTransferHook>;
  return { provider, program, hookProgram };
}

export function findConfigPda(
  programId: PublicKey,
  authority: PublicKey,
  configId: number
): [PublicKey, number] {
  const configIdBuf = Buffer.alloc(8);
  configIdBuf.writeBigUInt64LE(BigInt(configId));
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, authority.toBuffer(), configIdBuf],
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

export function getTokenAccount(
  mint: PublicKey,
  owner: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function createTokenAccount(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer?: Keypair
): Promise<PublicKey> {
  const ata = getTokenAccount(mint, owner);
  const ix = createAssociatedTokenAccountInstruction(
    payer ? payer.publicKey : provider.wallet.publicKey,
    ata,
    owner,
    mint,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tx = new anchor.web3.Transaction().add(ix);
  if (payer) {
    tx.feePayer = payer.publicKey;
    const { blockhash, lastValidBlockHeight } =
      await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(payer);
    const sig = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    });
  } else {
    await provider.sendAndConfirm(tx);
  }
  return ata;
}

export async function airdrop(
  provider: anchor.AnchorProvider,
  address: PublicKey,
  amount: number = 10 * LAMPORTS_PER_SOL
) {
  const sig = await provider.connection.requestAirdrop(address, amount);
  await provider.connection.confirmTransaction(sig);
}

export interface StablecoinSetup {
  authority: Keypair;
  config: PublicKey;
  configBump: number;
  mint: PublicKey;
  mintBump: number;
  treasury: PublicKey;
  configId: number;
}

export async function initializeStablecoin(
  program: Program<SssToken>,
  provider: anchor.AnchorProvider,
  preset: Preset,
  hookProgram?: Program<SssTransferHook>,
  options?: {
    authority?: Keypair;
    configId?: number;
    decimals?: number;
    name?: string;
    symbol?: string;
    uri?: string;
  }
): Promise<StablecoinSetup> {
  const authority = options?.authority || Keypair.generate();
  const configId = options?.configId || 0;
  const decimals = options?.decimals || 6;
  const name = options?.name || "Test Stablecoin";
  const symbol = options?.symbol || "TUSD";
  const uri = options?.uri || "https://example.com/metadata.json";

  await airdrop(provider, authority.publicKey);

  const [config, configBump] = findConfigPda(
    program.programId,
    authority.publicKey,
    configId
  );
  const [mint, mintBump] = findMintPda(program.programId, config);

  // Create a treasury keypair (we'll use a simple pubkey for now)
  const treasuryOwner = Keypair.generate();
  const treasury = getTokenAccount(mint, treasuryOwner.publicKey);

  const accounts: any = {
    authority: authority.publicKey,
    config,
    mint,
    treasury,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  };

  if (preset >= Preset.Compliant && hookProgram) {
    accounts.transferHookProgram = hookProgram.programId;
  } else {
    accounts.transferHookProgram = null;
  }

  const configIdBuf = Buffer.alloc(8);
  configIdBuf.writeBigUInt64LE(BigInt(configId));

  await program.methods
    .initialize({
      configId: new anchor.BN(configId),
      preset,
      decimals,
      name,
      symbol,
      uri,
    })
    .accounts(accounts)
    .signers([authority])
    .rpc();

  return { authority, config, configBump, mint, mintBump, treasury, configId };
}

export async function assignRole(
  program: Program<SssToken>,
  authority: Keypair,
  config: PublicKey,
  holder: PublicKey,
  role: Role
): Promise<PublicKey> {
  const [roleAssignment] = findRolePda(
    program.programId,
    config,
    holder,
    role
  );

  await program.methods
    .assignRole(role)
    .accounts({
      authority: authority.publicKey,
      config,
      holder,
      roleAssignment,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return roleAssignment;
}

export async function setupMinter(
  program: Program<SssToken>,
  provider: anchor.AnchorProvider,
  authority: Keypair,
  config: PublicKey,
  minter: PublicKey,
  allowance: number
): Promise<PublicKey> {
  // Assign minter role
  await assignRole(program, authority, config, minter, Role.Minter);

  // Update minter info
  const [minterInfo] = findMinterPda(program.programId, config, minter);
  await program.methods
    .updateMinter(new anchor.BN(allowance), true)
    .accounts({
      authority: authority.publicKey,
      config,
      minter,
      minterInfo,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return minterInfo;
}
