import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";
import {
  getPrograms,
  initializeStablecoin,
  assignRole,
  findRolePda,
  airdrop,
  Role,
  Preset,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError, expectPublicKey } from "./helpers/assertions";

describe("Roles & Access Control", () => {
  const { provider, program } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(program, provider, Preset.Minimal, undefined, {
      configId: 300,
    });
  });

  describe("Role Assignment", () => {
    it("assigns all valid SSS-1 roles", async () => {
      const roles = [Role.Minter, Role.Burner, Role.Pauser, Role.FreezeAuth];
      for (const role of roles) {
        const holder = Keypair.generate();
        const pda = await assignRole(
          program,
          setup.authority,
          setup.config,
          holder.publicKey,
          role
        );
        const data = await program.account.roleAssignment.fetch(pda);
        expect(data.role).to.equal(role);
        expectPublicKey(data.holder, holder.publicKey);
        expectPublicKey(data.assignedBy, setup.authority.publicKey);
        expect(data.assignedAt.toNumber()).to.be.greaterThan(0);
      }
    });

    it("prevents duplicate role assignment", async () => {
      const holder = Keypair.generate();
      await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Minter
      );

      await expectError(
        () =>
          assignRole(
            program,
            setup.authority,
            setup.config,
            holder.publicKey,
            Role.Minter
          ),
        "already in use"
      );
    });

    it("allows same holder to have multiple different roles", async () => {
      const holder = Keypair.generate();
      await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Burner
      );
      await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Pauser
      );

      const [burnerPda] = findRolePda(
        program.programId,
        setup.config,
        holder.publicKey,
        Role.Burner
      );
      const [pauserPda] = findRolePda(
        program.programId,
        setup.config,
        holder.publicKey,
        Role.Pauser
      );

      const burnerData = await program.account.roleAssignment.fetch(burnerPda);
      const pauserData = await program.account.roleAssignment.fetch(pauserPda);
      expect(burnerData.role).to.equal(Role.Burner);
      expect(pauserData.role).to.equal(Role.Pauser);
    });
  });

  describe("Role Revocation", () => {
    it("revokes a role and closes the PDA", async () => {
      const holder = Keypair.generate();
      const pda = await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.FreezeAuth
      );

      const balanceBefore = await provider.connection.getBalance(
        setup.authority.publicKey
      );

      await program.methods
        .revokeRole(Role.FreezeAuth)
        .accounts({
          authority: setup.authority.publicKey,
          config: setup.config,
          holder: holder.publicKey,
          roleAssignment: pda,
        })
        .signers([setup.authority])
        .rpc();

      const info = await provider.connection.getAccountInfo(pda);
      expect(info).to.be.null;

      // Rent should be returned to authority
      const balanceAfter = await provider.connection.getBalance(
        setup.authority.publicKey
      );
      expect(balanceAfter).to.be.greaterThan(balanceBefore - 10000);
    });

    it("rejects revocation from non-authority", async () => {
      const holder = Keypair.generate();
      const imposter = Keypair.generate();
      await airdrop(provider, imposter.publicKey);

      const pda = await assignRole(
        program,
        setup.authority,
        setup.config,
        holder.publicKey,
        Role.Minter
      );

      await expectError(
        () =>
          program.methods
            .revokeRole(Role.Minter)
            .accounts({
              authority: imposter.publicKey,
              config: setup.config,
              holder: holder.publicKey,
              roleAssignment: pda,
            })
            .signers([imposter])
            .rpc(),
        "Unauthorized"
      );
    });
  });

  describe("Authority Transfer", () => {
    it("completes two-step authority transfer", async () => {
      const newAuth = Keypair.generate();
      await airdrop(provider, newAuth.publicKey);

      // Use a fresh config for this test
      const transferSetup = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { configId: 301 }
      );

      // Step 1: Initiate
      await program.methods
        .initiateAuthorityTransfer()
        .accounts({
          authority: transferSetup.authority.publicKey,
          config: transferSetup.config,
          newAuthority: newAuth.publicKey,
        })
        .signers([transferSetup.authority])
        .rpc();

      let config = await program.account.stablecoinConfig.fetch(
        transferSetup.config
      );
      expectPublicKey(config.pendingAuthority, newAuth.publicKey);

      // Step 2: Accept
      await program.methods
        .acceptAuthority()
        .accounts({
          newAuthority: newAuth.publicKey,
          config: transferSetup.config,
        })
        .signers([newAuth])
        .rpc();

      config = await program.account.stablecoinConfig.fetch(
        transferSetup.config
      );
      expectPublicKey(config.masterAuthority, newAuth.publicKey);
      expect(config.pendingAuthority.toString()).to.equal(
        anchor.web3.PublicKey.default.toString()
      );
    });

    it("old authority cannot act after transfer", async () => {
      const newAuth = Keypair.generate();
      await airdrop(provider, newAuth.publicKey);

      const setup2 = await initializeStablecoin(
        program,
        provider,
        Preset.Minimal,
        undefined,
        { configId: 302 }
      );

      await program.methods
        .initiateAuthorityTransfer()
        .accounts({
          authority: setup2.authority.publicKey,
          config: setup2.config,
          newAuthority: newAuth.publicKey,
        })
        .signers([setup2.authority])
        .rpc();

      await program.methods
        .acceptAuthority()
        .accounts({
          newAuthority: newAuth.publicKey,
          config: setup2.config,
        })
        .signers([newAuth])
        .rpc();

      // Old authority should fail
      const holder = Keypair.generate();
      const [rolePda] = findRolePda(
        program.programId,
        setup2.config,
        holder.publicKey,
        Role.Minter
      );

      await expectError(
        () =>
          program.methods
            .assignRole(Role.Minter)
            .accounts({
              authority: setup2.authority.publicKey,
              config: setup2.config,
              holder: holder.publicKey,
              roleAssignment: rolePda,
              systemProgram: SystemProgram.programId,
            })
            .signers([setup2.authority])
            .rpc(),
        "Unauthorized"
      );
    });
  });
});
