import {
  PublicKey,
  SystemProgram,
  Keypair,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
} from "./pda";
import {
  StablecoinConfig,
  MinterInfo,
  RoleAssignment,
  Role,
  Preset,
  InitializeParams,
} from "./types";
import { ComplianceModule } from "./compliance";
import { presetToString, presetRequiresHookProgram } from "./presets";

export interface CreateParams {
  authority: Keypair;
  configId?: number;
  preset: Preset;
  decimals?: number;
  name: string;
  symbol: string;
  uri?: string;
  hookProgramId?: PublicKey;
}

export class SolanaStablecoin {
  public readonly config: PublicKey;
  public readonly mint: PublicKey;
  public readonly compliance: ComplianceModule;

  private constructor(
    public readonly program: Program,
    public readonly provider: AnchorProvider,
    config: PublicKey,
    mint: PublicKey,
    hookProgramId?: PublicKey
  ) {
    this.config = config;
    this.mint = mint;
    this.compliance = new ComplianceModule(program, config, hookProgramId);
  }

  static async create(
    program: Program,
    provider: AnchorProvider,
    params: CreateParams
  ): Promise<SolanaStablecoin> {
    const configId = params.configId ?? 0;
    const decimals = params.decimals ?? 6;
    const uri = params.uri ?? "";

    const [config] = findConfigPda(
      program.programId,
      params.authority.publicKey,
      configId
    );
    const [mint] = findMintPda(program.programId, config);

    const treasuryOwner = Keypair.generate();
    const treasury = getAssociatedTokenAddressSync(
      mint,
      treasuryOwner.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accounts: any = {
      authority: params.authority.publicKey,
      config,
      mint,
      treasury,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      transferHookProgram:
        presetRequiresHookProgram(params.preset) && params.hookProgramId
          ? params.hookProgramId
          : null,
    };

    await program.methods
      .initialize({
        configId: new BN(configId),
        preset: params.preset,
        decimals,
        name: params.name,
        symbol: params.symbol,
        uri,
      } as InitializeParams)
      .accounts(accounts)
      .signers([params.authority])
      .rpc();

    return new SolanaStablecoin(
      program,
      provider,
      config,
      mint,
      params.hookProgramId
    );
  }

  static async load(
    program: Program,
    provider: AnchorProvider,
    configAddress: PublicKey,
    hookProgramId?: PublicKey
  ): Promise<SolanaStablecoin> {
    const configData = await (program.account as any).stablecoinConfig.fetch(
      configAddress
    );
    return new SolanaStablecoin(
      program,
      provider,
      configAddress,
      configData.mint,
      hookProgramId
    );
  }

  async getConfig(): Promise<StablecoinConfig> {
    return await (this.program.account as any).stablecoinConfig.fetch(
      this.config
    );
  }

  async isPaused(): Promise<boolean> {
    const config = await this.getConfig();
    return config.paused;
  }

  async totalSupply(): Promise<BN> {
    const config = await this.getConfig();
    return config.totalMinted.sub(config.totalBurned);
  }

  async getBalance(owner: PublicKey): Promise<BN> {
    const ata = this.getTokenAccount(owner);
    try {
      const info = await this.provider.connection.getTokenAccountBalance(ata);
      return new BN(info.value.amount);
    } catch {
      return new BN(0);
    }
  }

  getTokenAccount(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  // --- Supply Management ---

  async mintTokens(
    minter: Keypair,
    recipient: PublicKey,
    amount: BN
  ): Promise<string> {
    const [minterInfo] = findMinterPda(
      this.program.programId,
      this.config,
      minter.publicKey
    );
    const recipientAta = this.getTokenAccount(recipient);

    return await this.program.methods
      .mintTokens(amount)
      .accounts({
        minter: minter.publicKey,
        config: this.config,
        minterInfo,
        mint: this.mint,
        recipientTokenAccount: recipientAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();
  }

  async burnTokens(burner: Keypair, amount: BN): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      burner.publicKey,
      Role.Burner
    );
    const burnerAta = this.getTokenAccount(burner.publicKey);

    return await this.program.methods
      .burnTokens(amount)
      .accounts({
        burner: burner.publicKey,
        config: this.config,
        roleAssignment,
        mint: this.mint,
        burnerTokenAccount: burnerAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([burner])
      .rpc();
  }

  // --- Account Management ---

  async freezeAccount(
    freezeAuth: Keypair,
    tokenAccount: PublicKey
  ): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      freezeAuth.publicKey,
      Role.FreezeAuth
    );

    return await this.program.methods
      .freezeAccount()
      .accounts({
        freezeAuthority: freezeAuth.publicKey,
        config: this.config,
        roleAssignment,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuth])
      .rpc();
  }

  async thawAccount(
    freezeAuth: Keypair,
    tokenAccount: PublicKey
  ): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      freezeAuth.publicKey,
      Role.FreezeAuth
    );

    return await this.program.methods
      .thawAccount()
      .accounts({
        freezeAuthority: freezeAuth.publicKey,
        config: this.config,
        roleAssignment,
        mint: this.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuth])
      .rpc();
  }

  // --- Pause/Unpause ---

  async pause(pauser: Keypair): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      pauser.publicKey,
      Role.Pauser
    );

    return await this.program.methods
      .pause()
      .accounts({
        pauser: pauser.publicKey,
        config: this.config,
        roleAssignment,
      })
      .signers([pauser])
      .rpc();
  }

  async unpause(pauser: Keypair): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      pauser.publicKey,
      Role.Pauser
    );

    return await this.program.methods
      .unpause()
      .accounts({
        pauser: pauser.publicKey,
        config: this.config,
        roleAssignment,
      })
      .signers([pauser])
      .rpc();
  }

  // --- Role Management ---

  async assignRole(
    authority: Keypair,
    holder: PublicKey,
    role: Role
  ): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      holder,
      role
    );

    return await this.program.methods
      .assignRole(role)
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        holder,
        roleAssignment,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  }

  async revokeRole(
    authority: Keypair,
    holder: PublicKey,
    role: Role
  ): Promise<string> {
    const [roleAssignment] = findRolePda(
      this.program.programId,
      this.config,
      holder,
      role
    );

    return await this.program.methods
      .revokeRole(role)
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        holder,
        roleAssignment,
      })
      .signers([authority])
      .rpc();
  }

  async hasRole(holder: PublicKey, role: Role): Promise<boolean> {
    const [pda] = findRolePda(
      this.program.programId,
      this.config,
      holder,
      role
    );
    const info = await this.provider.connection.getAccountInfo(pda);
    return info !== null;
  }

  async getRoleAssignment(
    holder: PublicKey,
    role: Role
  ): Promise<RoleAssignment | null> {
    const [pda] = findRolePda(
      this.program.programId,
      this.config,
      holder,
      role
    );
    try {
      return await (this.program.account as any).roleAssignment.fetch(pda);
    } catch {
      return null;
    }
  }

  // --- Minter Management ---

  async updateMinter(
    authority: Keypair,
    minter: PublicKey,
    allowance: BN,
    active: boolean
  ): Promise<string> {
    const [minterInfo] = findMinterPda(
      this.program.programId,
      this.config,
      minter
    );

    return await this.program.methods
      .updateMinter(allowance, active)
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        minter,
        minterInfo,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  }

  async getMinterInfo(minter: PublicKey): Promise<MinterInfo | null> {
    const [pda] = findMinterPda(
      this.program.programId,
      this.config,
      minter
    );
    try {
      return await (this.program.account as any).minterInfo.fetch(pda);
    } catch {
      return null;
    }
  }

  // --- Authority Transfer ---

  async initiateAuthorityTransfer(
    authority: Keypair,
    newAuthority: PublicKey
  ): Promise<string> {
    return await this.program.methods
      .initiateAuthorityTransfer()
      .accounts({
        authority: authority.publicKey,
        config: this.config,
        newAuthority,
      })
      .signers([authority])
      .rpc();
  }

  async acceptAuthority(newAuthority: Keypair): Promise<string> {
    return await this.program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: newAuthority.publicKey,
        config: this.config,
      })
      .signers([newAuthority])
      .rpc();
  }

  // --- Display Helpers ---

  async describe(): Promise<string> {
    const config = await this.getConfig();
    const supply = config.totalMinted.sub(config.totalBurned);
    return [
      `Stablecoin Config: ${this.config.toBase58()}`,
      `Preset: ${presetToString(config.preset as Preset)}`,
      `Mint: ${this.mint.toBase58()}`,
      `Authority: ${config.masterAuthority.toBase58()}`,
      `Decimals: ${config.decimals}`,
      `Total Minted: ${config.totalMinted.toString()}`,
      `Total Burned: ${config.totalBurned.toString()}`,
      `Supply: ${supply.toString()}`,
      `Paused: ${config.paused}`,
    ].join("\n");
  }
}
