import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

/**
 * The canonical sss-token program ID.
 * All allowlist PDAs are derived under this program.
 */
export const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB"
);

/** Seed prefix used for allowlist PDAs, matching the on-chain program. */
export const ALLOWLIST_SEED = Buffer.from("allowlist");

/**
 * On-chain layout of an AllowlistEntry account.
 * Mirrors the Rust struct defined in the sss-token program.
 */
export interface AllowlistEntry {
  /** The StablecoinConfig PDA this entry belongs to. */
  config: PublicKey;
  /** The wallet address that has been allowlisted. */
  address: PublicKey;
  /** The authority that added this entry. */
  addedBy: PublicKey;
  /** Unix timestamp (seconds) when the entry was created. */
  createdAt: number;
  /** PDA bump seed. */
  bump: number;
}

/**
 * Derives the allowlist PDA for a given config and address.
 *
 * Seeds: ["allowlist", config.toBuffer(), address.toBuffer()]
 * Program: sss-token (VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB)
 *
 * @param programId - The sss-token program ID (defaults to SSS_TOKEN_PROGRAM_ID).
 * @param config    - The StablecoinConfig PDA address.
 * @param address   - The wallet address to check.
 * @returns [pda, bump] — the derived PDA and its canonical bump.
 */
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

/**
 * AllowlistModule manages the SSS-3 allowlist, which gates participation in
 * confidential transfers.
 *
 * Under the SSS-3 (Private) preset, the transfer hook program verifies that
 * both the sender and recipient have an active AllowlistEntry PDA before
 * allowing a confidential transfer. Only an authority with the appropriate
 * role may add or remove entries.
 *
 * PDA layout: ["allowlist", config, address] under sss-token program ID.
 */
export class AllowlistModule {
  private readonly programId: PublicKey;

  constructor(
    private readonly program: Program,
    private readonly config: PublicKey
  ) {
    this.programId = program.programId;
  }

  /**
   * Adds an address to the allowlist by calling the sss-token
   * `add_to_allowlist` instruction.
   *
   * The authority must hold the AllowlistManager role (or be the master
   * authority) for the given config. The instruction creates a new
   * AllowlistEntry PDA and initialises it with the current timestamp.
   *
   * @param authority - The keypair authorized to manage the allowlist.
   * @param address   - The wallet public key to add.
   * @returns The transaction signature.
   */
  async addToAllowlist(authority: Keypair, address: PublicKey): Promise<string> {
    const [allowlistEntry] = findAllowlistPda(
      this.programId,
      this.config,
      address
    );

    return await this.program.methods
      .addToAllowlist()
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        address,
        allowlistEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Removes an address from the allowlist by calling the sss-token
   * `remove_from_allowlist` instruction.
   *
   * The instruction closes the AllowlistEntry PDA and refunds the rent
   * lamports to the authority.
   *
   * @param authority - The keypair authorized to manage the allowlist.
   * @param address   - The wallet public key to remove.
   * @returns The transaction signature.
   */
  async removeFromAllowlist(
    authority: Keypair,
    address: PublicKey
  ): Promise<string> {
    const [allowlistEntry] = findAllowlistPda(
      this.programId,
      this.config,
      address
    );

    return await this.program.methods
      .removeFromAllowlist()
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        address,
        allowlistEntry,
      })
      .signers([authority])
      .rpc();
  }

  /**
   * Checks whether an address is currently on the allowlist by inspecting
   * whether its AllowlistEntry PDA exists and holds data.
   *
   * This is a read-only RPC call and does not require a signer.
   *
   * @param address - The wallet public key to check.
   * @returns True if the address has an active allowlist entry, false otherwise.
   */
  async isAllowlisted(address: PublicKey): Promise<boolean> {
    const [pda] = findAllowlistPda(this.programId, this.config, address);
    const info = await this.program.provider.connection.getAccountInfo(pda);
    return info !== null && info.data.length > 0;
  }

  /**
   * Fetches all allowlist entries for this config using getProgramAccounts
   * with a memcmp filter on the config field.
   *
   * The config field begins at byte offset 8 (after the 8-byte Anchor
   * discriminator) and is 32 bytes long. This filter returns only entries
   * belonging to this StablecoinConfig PDA.
   *
   * Note: This call may be slow on validators that restrict getProgramAccounts.
   * For production use, consider maintaining an off-chain index.
   *
   * @returns An array of [pda, AllowlistEntry] pairs for all entries under
   *          this config.
   */
  async getAllowlistEntries(): Promise<Array<[PublicKey, AllowlistEntry]>> {
    const DISCRIMINATOR_SIZE = 8;

    const accounts = await this.program.provider.connection.getProgramAccounts(
      this.programId,
      {
        filters: [
          {
            // Match accounts whose config field (bytes 8-39) equals this config.
            memcmp: {
              offset: DISCRIMINATOR_SIZE,
              bytes: this.config.toBase58(),
            },
          },
        ],
      }
    );

    const results: Array<[PublicKey, AllowlistEntry]> = [];

    for (const { pubkey } of accounts) {
      try {
        const entry = await (this.program.account as any).allowlistEntry.fetch(
          pubkey
        );
        results.push([pubkey, entry as AllowlistEntry]);
      } catch {
        // Skip accounts that fail to deserialise as AllowlistEntry (e.g., other
        // account types that share the same config field layout).
      }
    }

    return results;
  }

  /**
   * Derives the allowlist PDA for a given address under this module's config.
   *
   * This is a pure helper that performs no RPC calls.
   *
   * @param address - The wallet public key.
   * @returns [pda, bump] for the allowlist entry.
   */
  findEntryPda(address: PublicKey): [PublicKey, number] {
    return findAllowlistPda(this.programId, this.config, address);
  }
}
