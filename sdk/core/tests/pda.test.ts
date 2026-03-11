import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
  findBlacklistPda,
  findAllowlistPda,
  findOracleConfigPda,
  findHookConfigPda,
  findExtraMetasPda,
  CONFIG_SEED,
  MINT_SEED,
  MINTER_SEED,
  ROLE_SEED,
  BLACKLIST_SEED,
  ALLOWLIST_SEED,
  ORACLE_SEED,
  HOOK_CONFIG_SEED,
  EXTRA_METAS_SEED,
} from "../src/pda";
import { Role } from "../src/types";

const PROGRAM_ID = new PublicKey(
  "VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB"
);
const HOOK_PROGRAM_ID = new PublicKey(
  "5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV"
);

describe("PDA Derivation", () => {
  const authority = Keypair.generate().publicKey;
  const holder = Keypair.generate().publicKey;
  const config = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;

  describe("findConfigPda", () => {
    it("derives config PDA with number", () => {
      const [pda, bump] = findConfigPda(PROGRAM_ID, authority, 0);
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
      expect(bump).to.be.lessThanOrEqual(255);
    });

    it("derives config PDA with BN", () => {
      const [pda1] = findConfigPda(PROGRAM_ID, authority, 42);
      const [pda2] = findConfigPda(PROGRAM_ID, authority, new BN(42));
      expect(pda1.toBase58()).to.equal(pda2.toBase58());
    });

    it("different config IDs produce different PDAs", () => {
      const [pda1] = findConfigPda(PROGRAM_ID, authority, 0);
      const [pda2] = findConfigPda(PROGRAM_ID, authority, 1);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("different authorities produce different PDAs", () => {
      const other = Keypair.generate().publicKey;
      const [pda1] = findConfigPda(PROGRAM_ID, authority, 0);
      const [pda2] = findConfigPda(PROGRAM_ID, other, 0);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("uses correct seeds", () => {
      const idBuf = Buffer.alloc(8);
      idBuf.writeBigUInt64LE(BigInt(5));
      const [expected] = PublicKey.findProgramAddressSync(
        [CONFIG_SEED, authority.toBuffer(), idBuf],
        PROGRAM_ID
      );
      const [actual] = findConfigPda(PROGRAM_ID, authority, 5);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });
  });

  describe("findMintPda", () => {
    it("derives mint PDA from config", () => {
      const [pda, bump] = findMintPda(PROGRAM_ID, config);
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
    });

    it("uses correct seeds", () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [MINT_SEED, config.toBuffer()],
        PROGRAM_ID
      );
      const [actual] = findMintPda(PROGRAM_ID, config);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });
  });

  describe("findMinterPda", () => {
    it("derives minter PDA from config and minter", () => {
      const [pda] = findMinterPda(PROGRAM_ID, config, holder);
      expect(pda).to.be.instanceOf(PublicKey);
    });

    it("different minters produce different PDAs", () => {
      const other = Keypair.generate().publicKey;
      const [pda1] = findMinterPda(PROGRAM_ID, config, holder);
      const [pda2] = findMinterPda(PROGRAM_ID, config, other);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });
  });

  describe("findRolePda", () => {
    it("derives role PDA for each role type", () => {
      const roles = [
        Role.Minter,
        Role.Burner,
        Role.Blacklister,
        Role.Pauser,
        Role.Seizer,
        Role.FreezeAuth,
      ];
      const pdas = roles.map((r) => findRolePda(PROGRAM_ID, config, holder, r));
      const addresses = pdas.map(([p]) => p.toBase58());
      const unique = new Set(addresses);
      expect(unique.size).to.equal(roles.length);
    });

    it("uses correct seeds", () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [
          ROLE_SEED,
          config.toBuffer(),
          holder.toBuffer(),
          Buffer.from([Role.Pauser]),
        ],
        PROGRAM_ID
      );
      const [actual] = findRolePda(PROGRAM_ID, config, holder, Role.Pauser);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });
  });

  describe("findBlacklistPda", () => {
    it("derives blacklist PDA", () => {
      const address = Keypair.generate().publicKey;
      const [pda] = findBlacklistPda(PROGRAM_ID, config, address);
      expect(pda).to.be.instanceOf(PublicKey);
    });

    it("uses correct seeds", () => {
      const address = Keypair.generate().publicKey;
      const [expected] = PublicKey.findProgramAddressSync(
        [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
        PROGRAM_ID
      );
      const [actual] = findBlacklistPda(PROGRAM_ID, config, address);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });
  });

  describe("findAllowlistPda", () => {
    it("derives allowlist PDA", () => {
      const address = Keypair.generate().publicKey;
      const [pda] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(pda).to.be.instanceOf(PublicKey);
    });
  });

  describe("findOracleConfigPda", () => {
    it("derives oracle config PDA", () => {
      const [pda] = findOracleConfigPda(PROGRAM_ID, config);
      expect(pda).to.be.instanceOf(PublicKey);
    });
  });

  describe("Hook PDAs", () => {
    it("derives hook config PDA", () => {
      const [pda] = findHookConfigPda(HOOK_PROGRAM_ID, mint);
      expect(pda).to.be.instanceOf(PublicKey);
    });

    it("derives extra metas PDA", () => {
      const [pda] = findExtraMetasPda(HOOK_PROGRAM_ID, mint);
      expect(pda).to.be.instanceOf(PublicKey);
    });

    it("uses correct seeds for hook config", () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [HOOK_CONFIG_SEED, mint.toBuffer()],
        HOOK_PROGRAM_ID
      );
      const [actual] = findHookConfigPda(HOOK_PROGRAM_ID, mint);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });

    it("uses correct seeds for extra metas", () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [EXTRA_METAS_SEED, mint.toBuffer()],
        HOOK_PROGRAM_ID
      );
      const [actual] = findExtraMetasPda(HOOK_PROGRAM_ID, mint);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });
  });
});
