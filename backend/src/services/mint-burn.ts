/**
 * Mint / burn service.
 *
 * Builds unsigned transactions for the sss-token program's `mint_tokens` and
 * `burn_tokens` instructions, submits them if a signer keypair is available,
 * and queries on-chain supply data.
 *
 * The service deliberately does NOT store private keys.  Callers are expected
 * to provide a pre-signed Transaction or a Keypair loaded from a secure
 * secrets manager.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getMint,
} from "@solana/spl-token";
import config from "../config.js";
import logger from "../logger.js";
import { queryEvents } from "../db/index.js";

// ── PDA derivation ────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(config.programId);

function deriveConfigPda(authority: PublicKey, configId: bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("stablecoin_config"),
      authority.toBytes(),
      Buffer.from(serializeU64LE(configId)),
    ],
    PROGRAM_ID
  );
  return pda;
}

function deriveMintPda(configPda: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sss_mint"), configPda.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

function deriveMinterInfoPda(configPda: PublicKey, minter: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("minter_info"), configPda.toBytes(), minter.toBytes()],
    PROGRAM_ID
  );
  return pda;
}

function serializeU64LE(value: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

// ── Instruction builders ──────────────────────────────────────────────────────

// Anchor instruction discriminators (first 8 bytes of sha256("global:<ix_name>"))
// These are static for the sss-token program.
const DISCRIMINATORS = {
  mint_tokens: Buffer.from([172, 137, 183, 14, 91, 105, 164, 240]),
  burn_tokens: Buffer.from([176, 28, 11, 53, 118, 129, 37, 69]),
} as const;

export interface MintParams {
  /** Authority pubkey (used to derive config PDA). */
  authority: PublicKey;
  /** Numeric config identifier. */
  configId: bigint;
  /** Minter wallet (must have a MinterInfo PDA and Minter role). */
  minter: PublicKey;
  /** Recipient wallet address. */
  recipient: PublicKey;
  /** Raw token amount (accounting for decimals). */
  amount: bigint;
}

/**
 * Build an unsigned `mint_tokens` instruction.
 */
export function buildMintInstruction(params: MintParams): TransactionInstruction {
  const configPda = deriveConfigPda(params.authority, params.configId);
  const mintPda = deriveMintPda(configPda);
  const minterInfoPda = deriveMinterInfoPda(configPda, params.minter);
  const recipientAta = getAssociatedTokenAddressSync(
    mintPda,
    params.recipient,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(params.amount);

  const data = Buffer.concat([DISCRIMINATORS.mint_tokens, amountBuf]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.minter, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: mintPda, isSigner: false, isWritable: true },
      { pubkey: minterInfoPda, isSigner: false, isWritable: true },
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export interface BurnParams {
  authority: PublicKey;
  configId: bigint;
  /** Burner wallet (must hold tokens and have Burner role). */
  burner: PublicKey;
  /** Burner's token account. */
  burnerTokenAccount: PublicKey;
  amount: bigint;
}

/**
 * Build an unsigned `burn_tokens` instruction.
 */
export function buildBurnInstruction(params: BurnParams): TransactionInstruction {
  const configPda = deriveConfigPda(params.authority, params.configId);
  const mintPda = deriveMintPda(configPda);

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(params.amount);

  const data = Buffer.concat([DISCRIMINATORS.burn_tokens, amountBuf]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: params.burner, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: mintPda, isSigner: false, isWritable: true },
      { pubkey: params.burnerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ── Supply tracking ───────────────────────────────────────────────────────────

export interface SupplyInfo {
  /** Current on-chain supply as a raw u64 string. */
  onChainSupply: string;
  /** Decimals of the mint. */
  decimals: number;
  /** Human-readable supply (onChainSupply / 10^decimals). */
  uiSupply: string;
  /** Cumulative minted from indexed events. */
  indexedTotalMinted: string;
  /** Cumulative burned from indexed events. */
  indexedTotalBurned: string;
}

/**
 * Fetch on-chain supply for the stablecoin identified by `configPda`.
 */
export async function getSupplyInfo(configPdaStr: string): Promise<SupplyInfo> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const configPda = new PublicKey(configPdaStr);
  const mintPda = deriveMintPda(configPda);

  const mintInfo = await getMint(connection, mintPda, "confirmed", TOKEN_2022_PROGRAM_ID);

  const onChainSupply = mintInfo.supply;
  const decimals = mintInfo.decimals;
  const divisor = BigInt(10 ** decimals);
  const uiSupply = (onChainSupply / divisor).toString();

  // Sum from indexed events as a consistency cross-check
  const mintEvents = queryEvents({ config: configPdaStr, eventType: "TokensMinted", limit: 10000 });
  const burnEvents = queryEvents({ config: configPdaStr, eventType: "TokensBurned", limit: 10000 });

  let totalMinted = 0n;
  let totalBurned = 0n;

  for (const ev of mintEvents) {
    try {
      const d = JSON.parse(ev.data) as { amount?: string };
      if (d.amount) totalMinted += BigInt(d.amount);
    } catch { /* skip malformed */ }
  }

  for (const ev of burnEvents) {
    try {
      const d = JSON.parse(ev.data) as { amount?: string };
      if (d.amount) totalBurned += BigInt(d.amount);
    } catch { /* skip malformed */ }
  }

  return {
    onChainSupply: onChainSupply.toString(),
    decimals,
    uiSupply,
    indexedTotalMinted: totalMinted.toString(),
    indexedTotalBurned: totalBurned.toString(),
  };
}

// ── Transaction submission ────────────────────────────────────────────────────

export interface SubmitMintParams extends MintParams {
  /** Signer keypair. In production this should come from a KMS/vault. */
  signer: Keypair;
}

/**
 * Build, sign, and submit a mint transaction.
 * Returns the transaction signature.
 */
export async function submitMint(params: SubmitMintParams): Promise<string> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  const configPda = deriveConfigPda(params.authority, params.configId);
  const mintPda = deriveMintPda(configPda);
  const recipientAta = getAssociatedTokenAddressSync(
    mintPda,
    params.recipient,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction();

  // Create ATA if it doesn't exist
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.signer.publicKey,
      recipientAta,
      params.recipient,
      mintPda,
      TOKEN_2022_PROGRAM_ID
    )
  );

  tx.add(buildMintInstruction(params));

  const sig = await sendAndConfirmTransaction(connection, tx, [params.signer], {
    commitment: "confirmed",
  });

  logger.info({ sig, amount: params.amount.toString(), recipient: params.recipient.toBase58() }, "Mint submitted");
  return sig;
}

export interface SubmitBurnParams extends BurnParams {
  signer: Keypair;
}

/**
 * Build, sign, and submit a burn transaction.
 * Returns the transaction signature.
 */
export async function submitBurn(params: SubmitBurnParams): Promise<string> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const tx = new Transaction();
  tx.add(buildBurnInstruction(params));

  const sig = await sendAndConfirmTransaction(connection, tx, [params.signer], {
    commitment: "confirmed",
  });

  logger.info({ sig, amount: params.amount.toString() }, "Burn submitted");
  return sig;
}

// ── Holder utilities ──────────────────────────────────────────────────────────

export interface HolderInfo {
  address: string;
  tokenAccount: string;
  balance: string;
  uiBalance: string;
}

/**
 * Fetch all token account holders for a given config's mint.
 * Uses getProgramAccounts with a memcmp filter on the mint address.
 */
export async function getHolders(configPdaStr: string): Promise<HolderInfo[]> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const configPda = new PublicKey(configPdaStr);
  const mintPda = deriveMintPda(configPda);

  const mintInfo = await getMint(connection, mintPda, "confirmed", TOKEN_2022_PROGRAM_ID);
  const decimals = mintInfo.decimals;
  const divisor = BigInt(10 ** decimals);

  // Token-2022 account layout: first 32 bytes = mint, next 32 = owner, next 8 = amount
  const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mintPda.toBase58() } },
    ],
  });

  return accounts.map((acc) => {
    const data = acc.account.data;
    const ownerBytes = data.slice(32, 64);
    const amountBytes = data.slice(64, 72);
    const owner = new PublicKey(ownerBytes).toBase58();
    const amount = Buffer.from(amountBytes).readBigUInt64LE();

    return {
      address: owner,
      tokenAccount: acc.pubkey.toBase58(),
      balance: amount.toString(),
      uiBalance: (amount / divisor).toString(),
    };
  });
}
