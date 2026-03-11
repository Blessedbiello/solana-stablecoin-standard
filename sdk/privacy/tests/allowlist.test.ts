import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  findAllowlistPda,
  AllowlistModule,
  ALLOWLIST_SEED,
  SSS_TOKEN_PROGRAM_ID,
} from "../src/allowlist";

const PROGRAM_ID = SSS_TOKEN_PROGRAM_ID;

describe("AllowlistModule", () => {
  const config = Keypair.generate().publicKey;

  describe("findAllowlistPda", () => {
    it("returns a valid PublicKey and bump", () => {
      const address = Keypair.generate().publicKey;
      const [pda, bump] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a("number");
      expect(bump).to.be.greaterThanOrEqual(0);
      expect(bump).to.be.lessThanOrEqual(255);
    });

    it("produces different PDAs for different addresses", () => {
      const address1 = Keypair.generate().publicKey;
      const address2 = Keypair.generate().publicKey;
      const [pda1] = findAllowlistPda(PROGRAM_ID, config, address1);
      const [pda2] = findAllowlistPda(PROGRAM_ID, config, address2);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("produces different PDAs for different configs", () => {
      const address = Keypair.generate().publicKey;
      const config2 = Keypair.generate().publicKey;
      const [pda1] = findAllowlistPda(PROGRAM_ID, config, address);
      const [pda2] = findAllowlistPda(PROGRAM_ID, config2, address);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("is deterministic — same inputs produce the same PDA", () => {
      const address = Keypair.generate().publicKey;
      const [pda1] = findAllowlistPda(PROGRAM_ID, config, address);
      const [pda2] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(pda1.toBase58()).to.equal(pda2.toBase58());
    });

    it("uses the correct seeds matching the on-chain program", () => {
      const address = Keypair.generate().publicKey;
      const [expected] = PublicKey.findProgramAddressSync(
        [ALLOWLIST_SEED, config.toBuffer(), address.toBuffer()],
        PROGRAM_ID
      );
      const [actual] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(actual.toBase58()).to.equal(expected.toBase58());
    });

    it("produces a PDA that is off the Ed25519 curve", () => {
      const address = Keypair.generate().publicKey;
      const [pda] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(PublicKey.isOnCurve(pda.toBytes())).to.be.false;
    });
  });

  describe("ALLOWLIST_SEED", () => {
    it("is the UTF-8 encoding of 'allowlist'", () => {
      expect(ALLOWLIST_SEED.toString("utf8")).to.equal("allowlist");
    });
  });

  describe("SSS_TOKEN_PROGRAM_ID", () => {
    it("is a valid PublicKey", () => {
      expect(SSS_TOKEN_PROGRAM_ID).to.be.instanceOf(PublicKey);
    });

    it("matches the canonical sss-token program address", () => {
      expect(SSS_TOKEN_PROGRAM_ID.toBase58()).to.equal(
        "VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB"
      );
    });
  });

  describe("AllowlistModule constructor", () => {
    it("constructs without throwing", () => {
      // A minimal stub satisfying the Program interface for unit tests.
      // Integration tests against a live validator use a real Program instance.
      const stubProgram = {
        programId: PROGRAM_ID,
        provider: {
          connection: {},
        },
        methods: {},
        account: {},
      } as any;

      expect(() => new AllowlistModule(stubProgram, config)).to.not.throw();
    });

    it("exposes findEntryPda as a pure helper", () => {
      const stubProgram = {
        programId: PROGRAM_ID,
        provider: { connection: {} },
        methods: {},
        account: {},
      } as any;

      const module = new AllowlistModule(stubProgram, config);
      const address = Keypair.generate().publicKey;
      const [pda] = module.findEntryPda(address);
      const [expected] = findAllowlistPda(PROGRAM_ID, config, address);
      expect(pda.toBase58()).to.equal(expected.toBase58());
    });

    it("findEntryPda agrees with module-level findAllowlistPda for any address", () => {
      const stubProgram = {
        programId: PROGRAM_ID,
        provider: { connection: {} },
        methods: {},
        account: {},
      } as any;

      const module = new AllowlistModule(stubProgram, config);

      for (let i = 0; i < 5; i++) {
        const address = Keypair.generate().publicKey;
        const [fromModule] = module.findEntryPda(address);
        const [fromHelper] = findAllowlistPda(PROGRAM_ID, config, address);
        expect(fromModule.toBase58()).to.equal(fromHelper.toBase58());
      }
    });
  });
});
