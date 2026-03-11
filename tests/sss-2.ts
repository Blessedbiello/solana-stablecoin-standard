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
  BLACKLIST_SEED,
} from "./helpers/setup";
import { expectError, expectBN, expectPublicKey } from "./helpers/assertions";

describe("SSS-2: Compliant Stablecoin", () => {
  const { provider, program, hookProgram } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(
      program,
      provider,
      Preset.Compliant,
      hookProgram,
      { configId: 200 }
    );
  });

  describe("Initialization", () => {
    it("creates SSS-2 config with correct preset", async () => {
      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expect(config.preset).to.equal(Preset.Compliant);
      expect(config.transferHookProgram.toString()).to.not.equal(
        PublicKey.default.toString()
      );
    });

    it("creates mint with permanent delegate and transfer hook extensions", async () => {
      const mintInfo = await provider.connection.getAccountInfo(setup.mint);
      expect(mintInfo).to.not.be.null;
      expect(mintInfo!.owner.toString()).to.equal(
        TOKEN_2022_PROGRAM_ID.toString()
      );
      // Mint should be larger than SSS-1 mint (has more extensions)
      expect(mintInfo!.data.length).to.be.greaterThan(200);
    });
  });

  describe("Blacklister Role", () => {
    it("allows blacklister role assignment on SSS-2", async () => {
      const holder = Keypair.generate();
      await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Blacklister
      );
    });

    it("allows seizer role assignment on SSS-2", async () => {
      const holder = Keypair.generate();
      await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Seizer
      );
    });
  });

  describe("Blacklist Management", () => {
    let blacklister: Keypair;

    before(async () => {
      blacklister = Keypair.generate();
      await airdrop(provider, blacklister.publicKey);
      await assignRole(
        program,
        setup.authority,
        setup.config,
        blacklister.publicKey,
        Role.Blacklister
      );
    });

    it("adds address to blacklist", async () => {
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        target.publicKey
      );
      const reasonHash = new Array(32).fill(0);
      reasonHash[0] = 1; // Non-zero reason

      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        blacklister.publicKey,
        Role.Blacklister
      );

      await program.methods
        .addToBlacklist(reasonHash)
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
          address: target.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      const entry = await program.account.blacklistEntry.fetch(blacklistEntry);
      expectPublicKey(entry.address, target.publicKey);
      expectPublicKey(entry.blacklistedBy, blacklister.publicKey);
    });

    it("removes address from blacklist", async () => {
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        target.publicKey
      );
      const reasonHash = new Array(32).fill(0);

      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        blacklister.publicKey,
        Role.Blacklister
      );

      // Add first
      await program.methods
        .addToBlacklist(reasonHash)
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
          address: target.publicKey,
          blacklistEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();

      // Then remove
      await program.methods
        .removeFromBlacklist()
        .accounts({
          blacklister: blacklister.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
          address: target.publicKey,
          blacklistEntry,
        })
        .signers([blacklister])
        .rpc();

      // Account should be closed
      const info = await provider.connection.getAccountInfo(blacklistEntry);
      expect(info).to.be.null;
    });

    it("rejects blacklist from non-blacklister", async () => {
      const imposter = Keypair.generate();
      await airdrop(provider, imposter.publicKey);
      const target = Keypair.generate();
      const [blacklistEntry] = findBlacklistPda(
        program.programId,
        setup.config,
        target.publicKey
      );
      const [fakePda] = findRolePda(
        program.programId,
        setup.config,
        imposter.publicKey,
        Role.Blacklister
      );

      await expectError(
        () =>
          program.methods
            .addToBlacklist(new Array(32).fill(0))
            .accounts({
              blacklister: imposter.publicKey,
              config: setup.config,
              roleAssignment: fakePda,
              address: target.publicKey,
              blacklistEntry,
              systemProgram: SystemProgram.programId,
            })
            .signers([imposter])
            .rpc(),
        "AccountNotInitialized" // Role PDA doesn't exist, so deserialization fails
      );
    });
  });

  describe("Mint & Burn on SSS-2", () => {
    let minter: Keypair;
    let minterInfoPda: PublicKey;
    let recipientAta: PublicKey;
    let recipient: Keypair;

    before(async () => {
      minter = Keypair.generate();
      await airdrop(provider, minter.publicKey);
      minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        50_000_000
      );

      recipient = Keypair.generate();
      await airdrop(provider, recipient.publicKey);
      recipientAta = await createTokenAccount(
        provider,
        setup.mint,
        recipient.publicKey,
        recipient
      );
    });

    it("mints tokens on SSS-2", async () => {
      await program.methods
        .mintTokens(new anchor.BN(5_000_000))
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

      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expectBN(config.totalMinted, 5_000_000);
    });

    it("burns tokens on SSS-2", async () => {
      await assignRole(
        program,
        setup.authority,
        setup.config,
        recipient.publicKey,
        Role.Burner
      );
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        recipient.publicKey,
        Role.Burner
      );

      await program.methods
        .burnTokens(new anchor.BN(1_000_000))
        .accounts({
          burner: recipient.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
          mint: setup.mint,
          burnerTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([recipient])
        .rpc();

      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expectBN(config.totalBurned, 1_000_000);
    });
  });

  describe("Seize", () => {
    let seizer: Keypair;
    let freezeAuth: Keypair;
    let victim: Keypair;
    let victimAta: PublicKey;
    let minter: Keypair;
    let minterInfoPda: PublicKey;

    before(async () => {
      seizer = Keypair.generate();
      freezeAuth = Keypair.generate();
      victim = Keypair.generate();
      minter = Keypair.generate();

      await Promise.all([
        airdrop(provider, seizer.publicKey),
        airdrop(provider, freezeAuth.publicKey),
        airdrop(provider, victim.publicKey),
        airdrop(provider, minter.publicKey),
      ]);

      // Initialize the transfer hook ExtraAccountMetaList
      const [hookConfig] = findHookConfigPda(
        hookProgram.programId,
        setup.mint
      );
      const [extraMetas] = findExtraMetasPda(
        hookProgram.programId,
        setup.mint
      );

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

      minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        100_000_000
      );

      victimAta = await createTokenAccount(
        provider,
        setup.mint,
        victim.publicKey,
        victim
      );

      // Mint tokens to victim
      await program.methods
        .mintTokens(new anchor.BN(10_000_000))
        .accounts({
          minter: minter.publicKey,
          config: setup.config,
          minterInfo: minterInfoPda,
          mint: setup.mint,
          recipientTokenAccount: victimAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();

      // Freeze victim's account
      const [freezeRolePda] = findRolePda(
        program.programId,
        setup.config,
        freezeAuth.publicKey,
        Role.FreezeAuth
      );
      await program.methods
        .freezeAccount()
        .accounts({
          freezeAuthority: freezeAuth.publicKey,
          config: setup.config,
          roleAssignment: freezeRolePda,
          mint: setup.mint,
          tokenAccount: victimAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuth])
        .rpc();
    });

    it("seizes tokens from frozen account", async () => {
      // Create treasury ATA
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

      // Seize needs extra accounts for the transfer hook
      const [hookConfig] = findHookConfigPda(
        hookProgram.programId,
        setup.mint
      );
      const [extraMetas] = findExtraMetasPda(
        hookProgram.programId,
        setup.mint
      );
      // Blacklist PDAs for source and destination (may not exist — that's OK)
      const [sourceBlacklist] = findBlacklistPda(
        program.programId,
        setup.config,
        victim.publicKey
      );
      const [destBlacklist] = findBlacklistPda(
        program.programId,
        setup.config,
        treasuryOwner.publicKey
      );

      await program.methods
        .seize(new anchor.BN(5_000_000))
        .accounts({
          seizer: seizer.publicKey,
          config: setup.config,
          roleAssignment: seizeRolePda,
          mint: setup.mint,
          sourceTokenAccount: victimAta,
          treasury: treasuryAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts([
          // extra_account_metas validation account (Token-2022 needs this)
          { pubkey: extraMetas, isWritable: false, isSigner: false },
          // extra[0]: hook_config
          { pubkey: hookConfig, isWritable: false, isSigner: false },
          // extra[1]: stablecoin_config
          { pubkey: setup.config, isWritable: false, isSigner: false },
          // extra[2]: sss_token_program
          { pubkey: program.programId, isWritable: false, isSigner: false },
          // extra[3]: source blacklist PDA
          { pubkey: sourceBlacklist, isWritable: false, isSigner: false },
          // extra[4]: destination blacklist PDA
          { pubkey: destBlacklist, isWritable: false, isSigner: false },
          // Hook program itself (Token-2022 needs to CPI into it)
          { pubkey: hookProgram.programId, isWritable: false, isSigner: false },
        ])
        .signers([seizer])
        .rpc();
    });
  });

  describe("Pause blocks operations on SSS-2", () => {
    let pauser: Keypair;
    let minter: Keypair;
    let minterInfoPda: PublicKey;

    before(async () => {
      pauser = Keypair.generate();
      minter = Keypair.generate();
      await Promise.all([
        airdrop(provider, pauser.publicKey),
        airdrop(provider, minter.publicKey),
      ]);

      await assignRole(
        program,
        setup.authority,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );

      minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        99_000_000
      );
    });

    it("rejects mint when paused", async () => {
      const [pauserRolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Pauser
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
            .rpc(),
        "Paused"
      );

      // Unpause for subsequent tests
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
  });
});
