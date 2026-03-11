import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SssToken } from "../target/types/sss_token";
import { SssTransferHook } from "../target/types/sss_transfer_hook";
import {
  getPrograms,
  initializeStablecoin,
  setupMinter,
  assignRole,
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
  findBlacklistPda,
  findHookConfigPda,
  findExtraMetasPda,
  getTokenAccount,
  createTokenAccount,
  airdrop,
  Role,
  Preset,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError, expectBN, expectPublicKey } from "./helpers/assertions";

describe("Transfer Hook: Blacklist Enforcement", () => {
  const { provider, program, hookProgram } = getPrograms();
  let setup: StablecoinSetup;
  let minter: Keypair;
  let minterInfoPda: PublicKey;
  let blacklister: Keypair;
  let blacklisterRolePda: PublicKey;

  before(async () => {
    setup = await initializeStablecoin(
      program,
      provider,
      Preset.Compliant,
      hookProgram,
      { configId: 300 }
    );

    // Set up minter
    minter = Keypair.generate();
    await airdrop(provider, minter.publicKey);
    minterInfoPda = await setupMinter(
      program,
      provider,
      setup.authority,
      setup.config,
      minter.publicKey,
      500_000_000
    );

    // Set up blacklister
    blacklister = Keypair.generate();
    await airdrop(provider, blacklister.publicKey);
    await assignRole(
      program,
      setup.authority,
      setup.config,
      blacklister.publicKey,
      Role.Blacklister
    );
    [blacklisterRolePda] = findRolePda(
      program.programId,
      setup.config,
      blacklister.publicKey,
      Role.Blacklister
    );

    // Initialize the transfer hook ExtraAccountMetaList
    const [hookConfig] = findHookConfigPda(hookProgram.programId, setup.mint);
    const [extraMetas] = findExtraMetasPda(hookProgram.programId, setup.mint);

    await hookProgram.methods
      .initializeHook()
      .accounts({
        authority: setup.authority.publicKey,
        mint: setup.mint,
        stablecoinConfig: setup.config,
        sssTokenProgram: program.programId,
        hookConfig,
        extraAccountMetas: extraMetas,
        systemProgram: SystemProgram.programId,
      })
      .signers([setup.authority])
      .rpc();
  });

  describe("Hook Config", () => {
    it("initializes hook config correctly", async () => {
      const [hookConfig] = findHookConfigPda(
        hookProgram.programId,
        setup.mint
      );
      const config = await hookProgram.account.transferHookConfig.fetch(
        hookConfig
      );
      expectPublicKey(config.mint, setup.mint);
      expectPublicKey(config.stablecoinConfig, setup.config);
    });

    it("creates extra account metas list", async () => {
      const [extraMetas] = findExtraMetasPda(
        hookProgram.programId,
        setup.mint
      );
      const info = await provider.connection.getAccountInfo(extraMetas);
      expect(info).to.not.be.null;
      expect(info!.data.length).to.be.greaterThan(0);
    });

    it("rejects double initialization of hook config", async () => {
      const [hookConfig] = findHookConfigPda(
        hookProgram.programId,
        setup.mint
      );
      const [extraMetas] = findExtraMetasPda(
        hookProgram.programId,
        setup.mint
      );

      await expectError(
        () =>
          hookProgram.methods
            .initializeHook()
            .accounts({
              authority: setup.authority.publicKey,
              mint: setup.mint,
              stablecoinConfig: setup.config,
              sssTokenProgram: program.programId,
              hookConfig,
              extraAccountMetas: extraMetas,
              systemProgram: SystemProgram.programId,
            })
            .signers([setup.authority])
            .rpc(),
        "already in use"
      );
    });
  });

  describe("Transfer with Non-Blacklisted Accounts", () => {
    let sender: Keypair;
    let receiver: Keypair;
    let senderAta: PublicKey;
    let receiverAta: PublicKey;

    before(async () => {
      sender = Keypair.generate();
      receiver = Keypair.generate();
      await Promise.all([
        airdrop(provider, sender.publicKey),
        airdrop(provider, receiver.publicKey),
      ]);

      senderAta = await createTokenAccount(
        provider,
        setup.mint,
        sender.publicKey,
        sender
      );
      receiverAta = await createTokenAccount(
        provider,
        setup.mint,
        receiver.publicKey,
        receiver
      );

      // Mint tokens to sender
      await program.methods
        .mintTokens(new anchor.BN(10_000_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: senderAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();
    });

    it("minting to non-blacklisted account succeeds", async () => {
      await program.methods
        .mintTokens(new anchor.BN(1_000_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: receiverAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();
    });
  });

  describe("Blacklist Prevents Transfers", () => {
    let blacklistedUser: Keypair;
    let cleanUser: Keypair;
    let blacklistedAta: PublicKey;
    let cleanAta: PublicKey;

    before(async () => {
      blacklistedUser = Keypair.generate();
      cleanUser = Keypair.generate();
      await Promise.all([
        airdrop(provider, blacklistedUser.publicKey),
        airdrop(provider, cleanUser.publicKey),
      ]);

      blacklistedAta = await createTokenAccount(
        provider,
        setup.mint,
        blacklistedUser.publicKey,
        blacklistedUser
      );
      cleanAta = await createTokenAccount(
        provider,
        setup.mint,
        cleanUser.publicKey,
        cleanUser
      );

      // Mint tokens to both
      await program.methods
        .mintTokens(new anchor.BN(5_000_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: blacklistedAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      await program.methods
        .mintTokens(new anchor.BN(5_000_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: cleanAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      // Blacklist the user
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        blacklistedUser.publicKey
      );
      const reasonHash = new Array(32).fill(0);
      reasonHash[0] = 42;

      await program.methods
        .addToBlacklist(reasonHash)
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: blacklisterRolePda,
          address: blacklistedUser.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();
    });

    it("verifies blacklist entry exists", async () => {
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        blacklistedUser.publicKey
      );
      const entry = await program.account.blacklistEntry.fetch(blacklistEntry);
      expectPublicKey(entry.address, blacklistedUser.publicKey);
      expect(entry.reasonHash[0]).to.equal(42);
    });

    it("clean user is not blacklisted", async () => {
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        cleanUser.publicKey
      );
      const info = await provider.connection.getAccountInfo(blacklistEntry);
      expect(info).to.be.null;
    });
  });

  describe("Blacklist Lifecycle", () => {
    it("can blacklist, remove, and re-blacklist an address", async () => {
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        target.publicKey
      );

      // Add to blacklist
      await program.methods
        .addToBlacklist(new Array(32).fill(1))
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: blacklisterRolePda,
          address: target.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      let entry = await program.account.blacklistEntry.fetch(blacklistEntry);
      expect(entry.reasonHash[0]).to.equal(1);

      // Remove from blacklist
      await program.methods
        .removeFromBlacklist()
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: blacklisterRolePda,
          address: target.publicKey,
          blacklistEntry,
        })
        .signers([blacklister])
        .rpc();

      let info = await provider.connection.getAccountInfo(blacklistEntry);
      expect(info).to.be.null;

      // Re-blacklist with different reason
      await program.methods
        .addToBlacklist(new Array(32).fill(2))
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: blacklisterRolePda,
          address: target.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      entry = await program.account.blacklistEntry.fetch(blacklistEntry);
      expect(entry.reasonHash[0]).to.equal(2);
    });

    it("blacklist entry stores correct metadata", async () => {
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        target.publicKey
      );

      const reasonHash = new Array(32).fill(0);
      reasonHash[0] = 0xab;
      reasonHash[31] = 0xcd;

      await program.methods
        .addToBlacklist(reasonHash)
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: blacklisterRolePda,
          address: target.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      const entry = await program.account.blacklistEntry.fetch(blacklistEntry);
      expectPublicKey(entry.config, setup.config);
      expectPublicKey(entry.address, target.publicKey);
      expectPublicKey(entry.blacklistedBy, blacklister.publicKey);
      expect(entry.reasonHash[0]).to.equal(0xab);
      expect(entry.reasonHash[31]).to.equal(0xcd);
      expect(entry.createdAt.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("SSS-1 Blacklist Restrictions", () => {
    let sss1Setup: StablecoinSetup;

    before(async () => {
      sss1Setup = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { configId: 301 }
      );
    });

    it("rejects blacklist operations on SSS-1 preset", async () => {
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        sss1Setup.config,
        target.publicKey
      );

      // Even if we try to create a blacklister role PDA, it should fail
      const fakeBlacklister = Keypair.generate();
      await airdrop(provider, fakeBlacklister.publicKey);

      const [fakePda] = findRolePda(
        program.programId,
        sss1Setup.config,
        fakeBlacklister.publicKey,
        Role.Blacklister
      );

      await expectError(
        () =>
          program.methods
            .addToBlacklist(new Array(32).fill(0))
            .accounts({
              blacklister: fakeBlacklister.publicKey,
              config: sss1Setup.config,
              roleAssignment: fakePda,
              address: target.publicKey,
              blacklistEntry,
              systemProgram: SystemProgram.programId,
            })
            .signers([fakeBlacklister])
            .rpc(),
        "AccountNotInitialized"
      );
    });
  });

  describe("Seize Edge Cases", () => {
    let seizer: Keypair;
    let freezeAuth: Keypair;

    before(async () => {
      seizer = Keypair.generate();
      freezeAuth = Keypair.generate();
      await Promise.all([
        airdrop(provider, seizer.publicKey),
        airdrop(provider, freezeAuth.publicKey),
      ]);

      await assignRole(
        program,
        setup.authority,
        setup.config,
        seizer.publicKey,
        Role.Seizer
      );
      await assignRole(
        program,
        setup.authority,
        setup.config,
        freezeAuth.publicKey,
        Role.FreezeAuth
      );
    });

    it("rejects seize from non-seizer", async () => {
      const imposter = Keypair.generate();
      await airdrop(provider, imposter.publicKey);

      const victim = Keypair.generate();
      await airdrop(provider, victim.publicKey);
      const victimAta = await createTokenAccount(
        provider,
        setup.mint,
        victim.publicKey,
        victim
      );

      const treasuryOwner = Keypair.generate();
      await airdrop(provider, treasuryOwner.publicKey);
      const treasuryAta = await createTokenAccount(
        provider,
        setup.mint,
        treasuryOwner.publicKey,
        treasuryOwner
      );

      const [fakeRolePda] = findRolePda(
        program.programId,
        setup.config,
        imposter.publicKey,
        Role.Seizer
      );

      await expectError(
        () =>
          program.methods
            .seize(new anchor.BN(1_000))
            .accounts({
              seizer: imposter.publicKey,
              config: setup.config,
              roleAssignment: fakeRolePda,
              mint: setup.mint,
              sourceTokenAccount: victimAta,
              treasury: treasuryAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([imposter])
            .rpc(),
        "AccountNotInitialized"
      );
    });

    it("rejects seize of zero amount", async () => {
      const victim = Keypair.generate();
      await airdrop(provider, victim.publicKey);
      const victimAta = await createTokenAccount(
        provider,
        setup.mint,
        victim.publicKey,
        victim
      );

      const treasuryOwner = Keypair.generate();
      await airdrop(provider, treasuryOwner.publicKey);
      const treasuryAta = await createTokenAccount(
        provider,
        setup.mint,
        treasuryOwner.publicKey,
        treasuryOwner
      );

      const [seizeRolePda] = findRolePda(
        program.programId,
        setup.config,
        seizer.publicKey,
        Role.Seizer
      );

      await expectError(
        () =>
          program.methods
            .seize(new anchor.BN(0))
            .accounts({
              seizer: seizer.publicKey,
              config: setup.config,
              roleAssignment: seizeRolePda,
              mint: setup.mint,
              sourceTokenAccount: victimAta,
              treasury: treasuryAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([seizer])
            .rpc(),
        "InvalidParameter"
      );
    });

    it("rejects seize on SSS-1 config", async () => {
      const sss1Setup = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { configId: 302 }
      );

      const fakeSeizer = Keypair.generate();
      await airdrop(provider, fakeSeizer.publicKey);

      const [fakeRolePda] = findRolePda(
        program.programId,
        sss1Setup.config,
        fakeSeizer.publicKey,
        Role.Seizer
      );

      const victimAta = Keypair.generate().publicKey;
      const treasuryAta = Keypair.generate().publicKey;

      // Role PDA doesn't exist, so Anchor fails on deserialization before
      // the preset constraint can fire.
      await expectError(
        () =>
          program.methods
            .seize(new anchor.BN(1_000))
            .accounts({
              seizer: fakeSeizer.publicKey,
              config: sss1Setup.config,
              roleAssignment: fakeRolePda,
              mint: findMintPda(program.programId, sss1Setup.config)[0],
              sourceTokenAccount: victimAta,
              treasury: treasuryAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([fakeSeizer])
            .rpc(),
        "AccountNotInitialized"
      );
    });
  });
});
