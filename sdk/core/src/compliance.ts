import { PublicKey, Connection } from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import {
  findBlacklistPda,
  findRolePda,
  findHookConfigPda,
  findExtraMetasPda,
} from "./pda";
import { Role, BlacklistEntry } from "./types";

export class ComplianceModule {
  constructor(
    private program: Program,
    private config: PublicKey,
    private hookProgramId?: PublicKey
  ) {}

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    const [pda] = findBlacklistPda(
      this.program.programId,
      this.config,
      address
    );
    const info = await this.program.provider.connection.getAccountInfo(pda);
    return info !== null && info.data.length > 0;
  }

  async getBlacklistEntry(
    address: PublicKey
  ): Promise<BlacklistEntry | null> {
    const [pda] = findBlacklistPda(
      this.program.programId,
      this.config,
      address
    );
    try {
      return await (this.program.account as any).blacklistEntry.fetch(pda);
    } catch {
      return null;
    }
  }

  async getBlacklistEntries(
    addresses: PublicKey[]
  ): Promise<Map<string, BlacklistEntry>> {
    const result = new Map<string, BlacklistEntry>();
    const pdas = addresses.map((addr) => ({
      addr,
      pda: findBlacklistPda(this.program.programId, this.config, addr)[0],
    }));

    const infos = await this.program.provider.connection.getMultipleAccountsInfo(
      pdas.map((p) => p.pda)
    );

    for (let i = 0; i < pdas.length; i++) {
      if (infos[i] !== null && infos[i]!.data.length > 0) {
        try {
          const entry = await (this.program.account as any).blacklistEntry.fetch(
            pdas[i].pda
          );
          result.set(pdas[i].addr.toBase58(), entry);
        } catch {
          // skip
        }
      }
    }
    return result;
  }

  buildBlacklistAddAccounts(
    blacklister: PublicKey,
    address: PublicKey
  ): {
    blacklister: PublicKey;
    config: PublicKey;
    roleAssignment: PublicKey;
    address: PublicKey;
    blacklistEntry: PublicKey;
    systemProgram: PublicKey;
  } {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      blacklister,
      Role.Blacklister
    );
    const [blacklistEntry] = findBlacklistPda(
      this.program.programId,
      this.config,
      address
    );
    return {
      blacklister,
      config: this.config,
      roleAssignment,
      address,
      blacklistEntry,
      systemProgram: PublicKey.default,
    };
  }

  buildBlacklistRemoveAccounts(
    blacklister: PublicKey,
    address: PublicKey
  ): {
    blacklister: PublicKey;
    config: PublicKey;
    roleAssignment: PublicKey;
    address: PublicKey;
    blacklistEntry: PublicKey;
  } {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      blacklister,
      Role.Blacklister
    );
    const [blacklistEntry] = findBlacklistPda(
      this.program.programId,
      this.config,
      address
    );
    return {
      blacklister,
      config: this.config,
      roleAssignment,
      address,
      blacklistEntry,
    };
  }

  buildSeizeAccounts(
    seizer: PublicKey,
    mint: PublicKey,
    sourceTokenAccount: PublicKey,
    treasury: PublicKey,
    tokenProgram: PublicKey
  ): {
    seizer: PublicKey;
    config: PublicKey;
    roleAssignment: PublicKey;
    mint: PublicKey;
    sourceTokenAccount: PublicKey;
    treasury: PublicKey;
    tokenProgram: PublicKey;
  } {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      seizer,
      Role.Seizer
    );
    return {
      seizer,
      config: this.config,
      roleAssignment,
      mint,
      sourceTokenAccount,
      treasury,
      tokenProgram,
    };
  }

  getSeizeRemainingAccounts(
    mint: PublicKey,
    sourceOwner: PublicKey,
    destOwner: PublicKey
  ): Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> {
    if (!this.hookProgramId) {
      return [];
    }
    const [extraMetas] = findExtraMetasPda(this.hookProgramId, mint);
    const [hookConfig] = findHookConfigPda(this.hookProgramId, mint);
    const [sourceBlacklist] = findBlacklistPda(
      this.program.programId,
      this.config,
      sourceOwner
    );
    const [destBlacklist] = findBlacklistPda(
      this.program.programId,
      this.config,
      destOwner
    );
    return [
      { pubkey: extraMetas, isWritable: false, isSigner: false },
      { pubkey: hookConfig, isWritable: false, isSigner: false },
      { pubkey: this.config, isWritable: false, isSigner: false },
      { pubkey: this.program.programId, isWritable: false, isSigner: false },
      { pubkey: sourceBlacklist, isWritable: false, isSigner: false },
      { pubkey: destBlacklist, isWritable: false, isSigner: false },
      { pubkey: this.hookProgramId, isWritable: false, isSigner: false },
    ];
  }
}
