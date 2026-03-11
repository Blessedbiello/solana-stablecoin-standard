import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  getPrograms,
  initializeStablecoin,
  setupMinter,
  assignRole,
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
  createTokenAccount,
  airdrop,
  Role,
  Preset,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError, expectBN } from "./helpers/assertions";

describe("Edge Cases", () => {
  const { provider, program } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(program, provider, Preset.Minimal, undefined, {
      configId: 400,
    });
  });

  describe("Minter Allowance Edge Cases", () => {
    it("minter can mint exactly up to allowance", async () => {
      const minter = Keypair.generate();
      await airdrop(provider, minter.publicKey);
      const minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        1_000
      );

      const recipient = Keypair.generate();
      await airdrop(provider, recipient.publicKey);
      const recipientAta = await createTokenAccount(
        provider,
        setup.mint,
        recipient.publicKey,
        recipient
      );

      // Mint exactly the allowance
      await program.methods
        .mintTokens(new anchor.BN(1_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      const data = await program.account.minterInfo.fetch(minterInfoPda);
      expectBN(data.totalMinted, 1_000);
      expectBN(data.allowance, 1_000);

      // Next mint of 1 should fail
      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(1))
            .accounts({
              minter: minter.publicKey,
              config: setup.config,
              minterInfo: minterInfoPda,
              mint: setup.mint,
              recipientTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minter])
            .rpc(),
        "AllowanceExceeded"
      );
    });

    it("deactivated minter cannot mint", async () => {
      const minter = Keypair.generate();
      await airdrop(provider, minter.publicKey);
      const minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        1_000_000
      );

      // Deactivate
      const [minterInfo] = findMinterPda(
        program.programId,
        setup.config,
        minter.publicKey
      );
      await program.methods
        .updateMinter(new anchor.BN(1_000_000), false)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          minter: minter.publicKey,
          minterInfo,
          systemProgram: SystemProgram.programId,
        })
        .signers([setup.authority])
        .rpc();

      const recipient = Keypair.generate();
      await airdrop(provider, recipient.publicKey);
      const recipientAta = await createTokenAccount(
        provider,
        setup.mint,
        recipient.publicKey,
        recipient
      );

      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(100))
            .accounts({
              minter: minter.publicKey,
              config: setup.config,
              minterInfo: minterInfoPda,
              mint: setup.mint,
              recipientTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minter])
            .rpc(),
        "MinterInactive"
      );
    });
  });

  describe("Paused State Edge Cases", () => {
    let pauser: Keypair;
    let pauserRolePda: anchor.web3.PublicKey;

    before(async () => {
      pauser = Keypair.generate();
      await airdrop(provider, pauser.publicKey);
      await assignRole(
        program,
        setup.authority,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );
      [pauserRolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );
    });

    it("mint blocked when paused", async () => {
      const minter = Keypair.generate();
      await airdrop(provider, minter.publicKey);
      const minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        10_000
      );

      // Pause
      await program.methods
        .pause()
        .accounts({
          pauser: pauser.publicKey,
          config: setup.config,
          roleAssignment: pauserRolePda,
        })
        .signers([pauser])
        .rpc();

      const recipient = Keypair.generate();
      await airdrop(provider, recipient.publicKey);
      const recipientAta = await createTokenAccount(
        provider,
        setup.mint,
        recipient.publicKey,
        recipient
      );

      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(100))
            .accounts({
              minter: minter.publicKey,
              config: setup.config,
              minterInfo: minterInfoPda,
              mint: setup.mint,
              recipientTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minter])
            .rpc(),
        "Paused"
      );

      // Unpause
      await program.methods
        .unpause()
        .accounts({
          pauser: pauser.publicKey,
          config: setup.config,
          roleAssignment: pauserRolePda,
        })
        .signers([pauser])
        .rpc();
    });

    it("unpause when not paused fails", async () => {
      await expectError(
        () =>
          program.methods
            .unpause()
            .accounts({
              pauser: pauser.publicKey,
              config: setup.config,
              roleAssignment: pauserRolePda,
            })
            .signers([pauser])
            .rpc(),
        "NotPaused"
      );
    });
  });

  describe("Multiple Configs", () => {
    it("creates multiple stablecoins from same authority", async () => {
      const configs = [];
      for (let i = 500; i < 503; i++) {
        const s = await initializeStablecoin(
          program,
          provider,
          Preset.Minimal,
          undefined,
          {
            authority: setup.authority,
            configId: i,
            name: `Coin ${i}`,
            symbol: `C${i}`,
          }
        );
        configs.push(s);
      }

      expect(configs.length).to.equal(3);
      // Each should have a unique mint
      const mints = configs.map((c) => c.mint.toString());
      const uniqueMints = new Set(mints);
      expect(uniqueMints.size).to.equal(3);
    });
  });

  describe("Invalid Parameters", () => {
    it("rejects name too long", async () => {
      const authority = Keypair.generate();
      await airdrop(provider, authority.publicKey);
      const [config] = findConfigPda(program.programId, authority.publicKey, 600);
      const [mint] = findMintPda(program.programId, config);

      await expectError(
        () =>
          program.methods
            .initialize({
              configId: new anchor.BN(600),
              preset: 1,
              decimals: 6,
              name: "A".repeat(33),
              symbol: "TST",
              uri: "https://example.com",
            })
            .accounts({
              authority: authority.publicKey,
              config,
              mint,
              treasury: authority.publicKey,
              transferHookProgram: null,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([authority])
            .rpc(),
        "InvalidParameter"
      );
    });

    it("rejects symbol too long", async () => {
      const authority = Keypair.generate();
      await airdrop(provider, authority.publicKey);
      const [config] = findConfigPda(program.programId, authority.publicKey, 601);
      const [mint] = findMintPda(program.programId, config);

      await expectError(
        () =>
          program.methods
            .initialize({
              configId: new anchor.BN(601),
              preset: 1,
              decimals: 6,
              name: "Test",
              symbol: "TOOLONGSYMB",
              uri: "https://example.com",
            })
            .accounts({
              authority: authority.publicKey,
              config,
              mint,
              treasury: authority.publicKey,
              transferHookProgram: null,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([authority])
            .rpc(),
        "InvalidParameter"
      );
    });
  });
});
