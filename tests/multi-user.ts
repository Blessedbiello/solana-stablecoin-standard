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
  findRolePda,
  findMinterPda,
  createTokenAccount,
  airdrop,
  Role,
  Preset,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError, expectBN } from "./helpers/assertions";

describe("Multi-User Scenarios", () => {
  const { provider, program, hookProgram } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(
      program,
      provider,
      Preset.Minimal,
      undefined,
      { configId: 400 }
    );
  });

  describe("Multiple Minters", () => {
    let minterA: Keypair;
    let minterB: Keypair;
    let minterAInfo: PublicKey;
    let minterBInfo: PublicKey;
    let recipient: Keypair;
    let recipientAta: PublicKey;

    before(async () => {
      minterA = Keypair.generate();
      minterB = Keypair.generate();
      recipient = Keypair.generate();
      await Promise.all([
        airdrop(provider, minterA.publicKey),
        airdrop(provider, minterB.publicKey),
        airdrop(provider, recipient.publicKey),
      ]);

      minterAInfo = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minterA.publicKey,
        10_000_000
      );
      minterBInfo = await setupMinter(
        program,
        provider,
        setup.authority,
        setup.config,
        minterB.publicKey,
        20_000_000
      );

      recipientAta = await createTokenAccount(
        provider,
        setup.mint,
        recipient.publicKey,
        recipient
      );
    });

    it("both minters can mint independently", async () => {
      await program.methods
        .mintTokens(new anchor.BN(3_000_000))
        .accounts({
          minter: minterA.publicKey,
          config: setup.config,
          minterInfo: minterAInfo,
          mint: setup.mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minterA])
        .rpc();

      await program.methods
        .mintTokens(new anchor.BN(5_000_000))
        .accounts({
          minter: minterB.publicKey,
          config: setup.config,
          minterInfo: minterBInfo,
          mint: setup.mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minterB])
        .rpc();

      const minterAData = await program.account.minterInfo.fetch(minterAInfo);
      expectBN(minterAData.totalMinted, 3_000_000);

      const minterBData = await program.account.minterInfo.fetch(minterBInfo);
      expectBN(minterBData.totalMinted, 5_000_000);
    });

    it("minter A cannot exceed their allowance", async () => {
      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(8_000_000)) // 3M already minted, 10M allowance
            .accounts({
              minter: minterA.publicKey,
              config: setup.config,
              minterInfo: minterAInfo,
              mint: setup.mint,
              recipientTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterA])
            .rpc(),
        "AllowanceExceeded"
      );
    });

    it("minter B has separate higher allowance", async () => {
      // B has 20M allowance, 5M minted, should be able to mint 10M more
      await program.methods
        .mintTokens(new anchor.BN(10_000_000))
        .accounts({
          minter: minterB.publicKey,
          config: setup.config,
          minterInfo: minterBInfo,
          mint: setup.mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minterB])
        .rpc();

      const minterBData = await program.account.minterInfo.fetch(minterBInfo);
      expectBN(minterBData.totalMinted, 15_000_000);
    });

    it("deactivating minter A does not affect minter B", async () => {
      const [minterAInfoPda] = findMinterPda(
        program.programId,
        setup.config,
        minterA.publicKey
      );

      await program.methods
        .updateMinter(new anchor.BN(10_000_000), false)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          minter: minterA.publicKey,
          minterInfo: minterAInfoPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([setup.authority])
        .rpc();

      // Minter A is now inactive
      await expectError(
        () =>
          program.methods
            .mintTokens(new anchor.BN(1_000))
            .accounts({
              minter: minterA.publicKey,
              config: setup.config,
              minterInfo: minterAInfo,
              mint: setup.mint,
              recipientTokenAccount: recipientAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([minterA])
            .rpc(),
        "MinterInactive"
      );

      // Minter B still works
      await program.methods
        .mintTokens(new anchor.BN(1_000))
        .accounts({
          minter: minterB.publicKey,
          config: setup.config,
          minterInfo: minterBInfo,
          mint: setup.mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minterB])
        .rpc();
    });
  });

  describe("Role Isolation", () => {
    let pauser: Keypair;
    let burner: Keypair;

    before(async () => {
      pauser = Keypair.generate();
      burner = Keypair.generate();
      await Promise.all([
        airdrop(provider, pauser.publicKey),
        airdrop(provider, burner.publicKey),
      ]);

      await assignRole(
        program,
        setup.authority,
        setup.config,
        pauser.publicKey,
        Role.Pauser
      );
      await assignRole(
        program,
        setup.authority,
        setup.config,
        burner.publicKey,
        Role.Burner
      );
    });

    it("pauser cannot burn tokens", async () => {
      const burnerAta = await createTokenAccount(
        provider,
        setup.mint,
        pauser.publicKey,
        pauser
      );
      const [wrongRolePda] = findRolePda(
        program.programId,
        setup.config,
        pauser.publicKey,
        Role.Burner
      );

      await expectError(
        () =>
          program.methods
            .burnTokens(new anchor.BN(1))
            .accounts({
              burner: pauser.publicKey,
              config: setup.config,
              roleAssignment: wrongRolePda,
              mint: setup.mint,
              burnerTokenAccount: burnerAta,
              tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([pauser])
            .rpc(),
        "AccountNotInitialized"
      );
    });

    it("burner cannot pause the stablecoin", async () => {
      const [wrongRolePda] = findRolePda(
        program.programId,
        setup.config,
        burner.publicKey,
        Role.Pauser
      );

      await expectError(
        () =>
          program.methods
            .pause()
            .accounts({
              pauser: burner.publicKey,
              config: setup.config,
              roleAssignment: wrongRolePda,
            })
            .signers([burner])
            .rpc(),
        "AccountNotInitialized"
      );
    });

    it("same user can hold multiple roles", async () => {
      const multiUser = Keypair.generate();
      await airdrop(provider, multiUser.publicKey);

      await assignRole(
        program,
        setup.authority,
        setup.config,
        multiUser.publicKey,
        Role.Pauser
      );
      await assignRole(
        program,
        setup.authority,
        setup.config,
        multiUser.publicKey,
        Role.FreezeAuth
      );

      // Verify both roles exist
      const [pauserPda] = findRolePda(
        program.programId,
        setup.config,
        multiUser.publicKey,
        Role.Pauser
      );
      const [freezePda] = findRolePda(
        program.programId,
        setup.config,
        multiUser.publicKey,
        Role.FreezeAuth
      );

      const pauserRole = await program.account.roleAssignment.fetch(pauserPda);
      expect(pauserRole.role).to.equal(Role.Pauser);

      const freezeRole = await program.account.roleAssignment.fetch(freezePda);
      expect(freezeRole.role).to.equal(Role.FreezeAuth);
    });

    it("revoking one role doesn't affect another", async () => {
      const user = Keypair.generate();
      await airdrop(provider, user.publicKey);

      await assignRole(
        program,
        setup.authority,
        setup.config,
        user.publicKey,
        Role.Pauser
      );
      await assignRole(
        program,
        setup.authority,
        setup.config,
        user.publicKey,
        Role.FreezeAuth
      );

      // Revoke pauser
      const [pauserPda] = findRolePda(
        program.programId,
        setup.config,
        user.publicKey,
        Role.Pauser
      );
      await program.methods
        .revokeRole(Role.Pauser)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          holder: user.publicKey,
          roleAssignment: pauserPda,
        })
        .signers([setup.authority])
        .rpc();

      // Freeze role should still exist
      const [freezePda] = findRolePda(
        program.programId,
        setup.config,
        user.publicKey,
        Role.FreezeAuth
      );
      const freezeRole = await program.account.roleAssignment.fetch(freezePda);
      expect(freezeRole.role).to.equal(Role.FreezeAuth);

      // Pauser role should be gone
      const pauserInfo = await provider.connection.getAccountInfo(pauserPda);
      expect(pauserInfo).to.be.null;
    });
  });

  describe("Authority Transfer", () => {
    it("completes two-step authority transfer", async () => {
      const newAuthority = Keypair.generate();
      await airdrop(provider, newAuthority.publicKey);

      // Use a fresh stablecoin for this test
      const freshSetup = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { configId: 401 }
      );

      // Step 1: Initiate transfer
      await program.methods
        .initiateAuthorityTransfer()
        .accounts({
          authority: freshSetup.authority.publicKey,
          config: freshSetup.config,
          newAuthority: newAuthority.publicKey,
        })
        .signers([freshSetup.authority])
        .rpc();

      let config = await program.account.stablecoinConfig.fetch(
        freshSetup.config
      );
      expect(config.pendingAuthority.toString()).to.equal(
        newAuthority.publicKey.toString()
      );

      // Step 2: Accept transfer
      await program.methods
        .acceptAuthority()
        .accounts({
          newAuthority: newAuthority.publicKey,
          config: freshSetup.config,
        })
        .signers([newAuthority])
        .rpc();

      config = await program.account.stablecoinConfig.fetch(freshSetup.config);
      expect(config.masterAuthority.toString()).to.equal(
        newAuthority.publicKey.toString()
      );
      expect(config.pendingAuthority.toString()).to.equal(
        PublicKey.default.toString()
      );

      // Old authority can no longer manage roles
      const holder = Keypair.generate();
      const [rolePda] = findRolePda(
        program.programId,
        freshSetup.config,
        holder.publicKey,
        Role.Pauser
      );
      await expectError(
        () =>
          program.methods
            .assignRole(Role.Pauser)
            .accounts({
              authority: freshSetup.authority.publicKey,
              config: freshSetup.config,
              holder: holder.publicKey,
              roleAssignment: rolePda,
              systemProgram: SystemProgram.programId,
            })
            .signers([freshSetup.authority])
            .rpc(),
        "Unauthorized"
      );

      // New authority can manage roles
      await program.methods
        .assignRole(Role.Pauser)
        .accounts({
          authority: newAuthority.publicKey,
          config: freshSetup.config,
          holder: holder.publicKey,
          roleAssignment: rolePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([newAuthority])
        .rpc();
    });
  });

  describe("Concurrent Operations", () => {
    it("supports multiple stablecoins from same authority", async () => {
      const authority = Keypair.generate();
      await airdrop(provider, authority.publicKey);

      const setup1 = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        {
          authority,
          configId: 402,
          name: "Coin A",
          symbol: "COINA",
        }
      );

      const setup2 = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        {
          authority,
          configId: 403,
          name: "Coin B",
          symbol: "COINB",
        }
      );

      // Both configs should exist independently
      const config1 = await program.account.stablecoinConfig.fetch(
        setup1.config
      );
      const config2 = await program.account.stablecoinConfig.fetch(
        setup2.config
      );

      expect(config1.mint.toString()).to.not.equal(config2.mint.toString());
      expect(config1.configId.toNumber()).to.equal(402);
      expect(config2.configId.toNumber()).to.equal(403);
    });

    it("roles are scoped to specific config", async () => {
      const authority = Keypair.generate();
      const holder = Keypair.generate();
      await Promise.all([
        airdrop(provider, authority.publicKey),
        airdrop(provider, holder.publicKey),
      ]);

      const configA = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { authority, configId: 404 }
      );
      const configB = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { authority, configId: 405 }
      );

      // Assign role only on config A
      await assignRole(
        program,
        authority,
        configA.config,
        holder.publicKey,
        Role.Pauser
      );

      // Role exists on config A
      const [rolePdaA] = findRolePda(
        program.programId,
        configA.config,
        holder.publicKey,
        Role.Pauser
      );
      const roleA = await program.account.roleAssignment.fetch(rolePdaA);
      expect(roleA.role).to.equal(Role.Pauser);

      // Role does not exist on config B
      const [rolePdaB] = findRolePda(
        program.programId,
        configB.config,
        holder.publicKey,
        Role.Pauser
      );
      const info = await provider.connection.getAccountInfo(rolePdaB);
      expect(info).to.be.null;
    });
  });
});
