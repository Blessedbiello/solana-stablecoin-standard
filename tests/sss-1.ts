import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SssToken } from "../target/types/sss_token";
import {
  getPrograms,
  initializeStablecoin,
  setupMinter,
  assignRole,
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
  getTokenAccount,
  createTokenAccount,
  airdrop,
  Role,
  Preset,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError, expectBN, expectPublicKey } from "./helpers/assertions";

describe("SSS-1: Minimal Stablecoin", () => {
  const { provider, program, hookProgram } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(program, provider, Preset.Minimal);
  });

  describe("Initialization", () => {
    it("creates config with correct state", async () => {
      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expectPublicKey(config.masterAuthority, setup.authority.publicKey);
      expectPublicKey(config.mint, setup.mint);
      expect(config.preset).to.equal(Preset.Minimal);
      expect(config.paused).to.be.false;
      expect(config.decimals).to.equal(6);
      expectBN(config.totalMinted, 0);
      expectBN(config.totalBurned, 0);
    });

    it("creates Token-2022 mint", async () => {
      const mintInfo = await provider.connection.getAccountInfo(setup.mint);
      expect(mintInfo).to.not.be.null;
      expect(mintInfo!.owner.toString()).to.equal(TOKEN_2022_PROGRAM_ID.toString());
    });

    it("rejects duplicate initialization", async () => {
      await expectError(
        () =>
          initializeStablecoin(program, provider, Preset.Minimal, undefined, {
            authority: setup.authority,
            configId: setup.configId,
          }),
        "already in use"
      );
    });

    it("allows multiple configs per authority with different IDs", async () => {
      const setup2 = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { authority: setup.authority, configId: 1 }
      );
      const config2 = await program.account.stablecoinConfig.fetch(setup2.config);
      expect(config2.preset).to.equal(Preset.Minimal);
    });

    it("rejects invalid preset", async () => {
      const authority = Keypair.generate();
      await airdrop(provider, authority.publicKey);
      const [config] = findConfigPda(program.programId, authority.publicKey, 99);
      const [mint] = findMintPda(program.programId, config);

      await expectError(
        () =>
          program.methods
            .initialize({
              configId: new anchor.BN(99),
              preset: 0,
              decimals: 6,
              name: "Bad",
              symbol: "BAD",
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
        "InvalidPreset"
      );
    });

    it("rejects decimals > 18", async () => {
      const authority = Keypair.generate();
      await airdrop(provider, authority.publicKey);
      const [config] = findConfigPda(program.programId, authority.publicKey, 50);
      const [mint] = findMintPda(program.programId, config);

      await expectError(
        () =>
          program.methods
            .initialize({
              configId: new anchor.BN(50),
              preset: 1,
              decimals: 19,
              name: "Bad",
              symbol: "BAD",
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

  describe("Role Management", () => {
    it("assigns a role", async () => {
      const holder = Keypair.generate();
      const rolePda = await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Minter
      );
      const roleData = await program.account.roleAssignment.fetch(rolePda);
      expect(roleData.role).to.equal(Role.Minter);
      expectPublicKey(roleData.holder, holder.publicKey);
    });

    it("revokes a role", async () => {
      const holder = Keypair.generate();
      const rolePda = await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Burner
      );

      await program.methods
        .revokeRole(Role.Burner)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          holder: holder.publicKey,
          roleAssignment: rolePda,
        })
        .signers([setup.authority])
        .rpc();

      // Account should be closed
      const info = await provider.connection.getAccountInfo(rolePda);
      expect(info).to.be.null;
    });

    it("rejects role assignment from non-authority", async () => {
      const imposter = Keypair.generate();
      await airdrop(provider, imposter.publicKey);
      const holder = Keypair.generate();
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        holder.publicKey,
        Role.Pauser
      );

      await expectError(
        () =>
          program.methods
            .assignRole(Role.Pauser)
            .accounts({
              authority: imposter.publicKey,
              config: setup.config,
              holder: holder.publicKey,
              roleAssignment: rolePda,
              systemProgram: SystemProgram.programId,
            })
            .signers([imposter])
            .rpc(),
        "Unauthorized"
      );
    });

    it("rejects SSS-2 roles on SSS-1 config", async () => {
      const holder = Keypair.generate();
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        holder.publicKey,
        Role.Blacklister
      );

      await expectError(
        () =>
          program.methods
            .assignRole(Role.Blacklister)
            .accounts({
              authority: setup.authority.publicKey,
              config: setup.config,
              holder: holder.publicKey,
              roleAssignment: rolePda,
              systemProgram: SystemProgram.programId,
            })
            .signers([setup.authority])
            .rpc(),
        "FeatureNotAvailable"
      );
    });

    it("assigns all SSS-1 roles", async () => {
      const roles = [Role.Minter, Role.Burner, Role.Pauser, Role.FreezeAuth];
      for (const role of roles) {
        const holder = Keypair.generate();
        await assignRole(program, setup.authority, setup.config, holder.publicKey, role);
      }
    });
  });

  describe("Minter Management", () => {
    it("creates and updates minter info", async () => {
      const minter = Keypair.generate();
      const minterInfo = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        1_000_000
      );

      const data = await program.account.minterInfo.fetch(minterInfo);
      expectBN(data.allowance, 1_000_000);
      expect(data.active).to.be.true;
      expectBN(data.totalMinted, 0);
    });

    it("deactivates a minter", async () => {
      const minter = Keypair.generate();
      const minterInfoPda = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minter.publicKey,
        500_000
      );

      const [minterInfo] = findMinterPda(
        program.programId,
        setup.config,
        minter.publicKey
      );

      await program.methods
        .updateMinter(new anchor.BN(0), false)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          minter: minter.publicKey,
          minterInfo,
          systemProgram: SystemProgram.programId,
        })
        .signers([setup.authority])
        .rpc();

      const data = await program.account.minterInfo.fetch(minterInfo);
      expect(data.active).to.be.false;
    });
  });

  describe("Mint & Burn", () => {
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
        10_000_000
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

    it("mints tokens", async () => {
      await program.methods
        .mintTokens(new anchor.BN(1_000_000))
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
      expectBN(config.totalMinted, 1_000_000);

      const minterData = await program.account.minterInfo.fetch(minterInfoPda);
      expectBN(minterData.totalMinted, 1_000_000);
    });

    it("rejects mint of zero", async () => {
      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(0))
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
        "InvalidMintAmount"
      );
    });

    it("rejects mint exceeding allowance", async () => {
      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(100_000_000))
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

    it("burns tokens", async () => {
      // Assign burner role to recipient
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
        .burnTokens(new anchor.BN(500_000))
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
      expectBN(config.totalBurned, 500_000);
    });

    it("rejects burn of zero", async () => {
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        recipient.publicKey,
        Role.Burner
      );

      await expectError(
        () =>
          program.methods
            .burnTokens(new anchor.BN(0))
            .accounts({
              burner: recipient.publicKey,
              config: setup.config,
              roleAssignment: rolePda,
              mint: setup.mint,
              burnerTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([recipient])
            .rpc(),
        "InvalidBurnAmount"
      );
    });
  });

  describe("Freeze & Thaw", () => {
    let freezeAuth: Keypair;
    let targetAta: PublicKey;
    let target: Keypair;

    before(async () => {
      freezeAuth = Keypair.generate();
      await airdrop(provider, freezeAuth.publicKey);
      await assignRole(
        program,
        setup.authority,
        setup.config,
        freezeAuth.publicKey,
        Role.FreezeAuth
      );

      target = Keypair.generate();
      await airdrop(provider, target.publicKey);
      targetAta = await createTokenAccount(
        provider,
        setup.mint,
        target.publicKey,
        target
      );
    });

    it("freezes an account", async () => {
      const [rolePda] = findRolePda(
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
          roleAssignment: rolePda,
          mint: setup.mint,
          tokenAccount: targetAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuth])
        .rpc();
    });

    it("thaws an account", async () => {
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        freezeAuth.publicKey,
        Role.FreezeAuth
      );

      await program.methods
        .thawAccount()
        .accounts({
          freezeAuthority: freezeAuth.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
          mint: setup.mint,
          tokenAccount: targetAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuth])
        .rpc();
    });
  });

  describe("Pause & Unpause", () => {
    let pauser: Keypair;

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
    });

    it("pauses the stablecoin", async () => {
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );

      await program.methods
        .pause()
        .accounts({
          pauser: pauser.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
        })
        .signers([pauser])
        .rpc();

      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expect(config.paused).to.be.true;
    });

    it("rejects double pause", async () => {
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );

      await expectError(
        () =>
          program.methods
            .pause()
            .accounts({
              pauser: pauser.publicKey,
              config: setup.config,
              roleAssignment: rolePda,
            })
            .signers([pauser])
            .rpc(),
        "Paused"
      );
    });

    it("unpauses the stablecoin", async () => {
      const [rolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );

      await program.methods
        .unpause()
        .accounts({
          pauser: pauser.publicKey,
          config: setup.config,
          roleAssignment: rolePda,
        })
        .signers([pauser])
        .rpc();

      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expect(config.paused).to.be.false;
    });
  });

  describe("Authority Transfer", () => {
    it("initiates authority transfer", async () => {
      const newAuth = Keypair.generate();

      await program.methods
        .initiateAuthorityTransfer()
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          newAuthority: newAuth.publicKey,
        })
        .signers([setup.authority])
        .rpc();

      const config = await program.account.stablecoinConfig.fetch(setup.config);
      expectPublicKey(config.pendingAuthority, newAuth.publicKey);
    });

    it("rejects accept from wrong authority", async () => {
      const imposter = Keypair.generate();
      await airdrop(provider, imposter.publicKey);

      await expectError(
        () =>
          program.methods
            .acceptAuthority()
            .accounts({
              newAuthority: imposter.publicKey,
              config: setup.config,
            })
            .signers([imposter])
            .rpc(),
        "InvalidPendingAuthority"
      );
    });
  });

  describe("View Instructions", () => {
    it("gets config info", async () => {
      await program.methods
        .getConfig()
        .accounts({ config: setup.config })
        .rpc();
    });
  });
});
