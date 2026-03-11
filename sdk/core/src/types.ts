import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export enum Preset {
  Minimal = 1,
  Compliant = 2,
  Private = 3,
}

export enum Role {
  Minter = 0,
  Burner = 1,
  Blacklister = 2,
  Pauser = 3,
  Seizer = 4,
  FreezeAuth = 5,
}

export interface StablecoinConfig {
  masterAuthority: PublicKey;
  pendingAuthority: PublicKey;
  mint: PublicKey;
  treasury: PublicKey;
  transferHookProgram: PublicKey;
  totalMinted: BN;
  totalBurned: BN;
  decimals: number;
  bump: number;
  paused: boolean;
  preset: number;
  configId: BN;
}

export interface MinterInfo {
  config: PublicKey;
  minter: PublicKey;
  allowance: BN;
  totalMinted: BN;
  bump: number;
  active: boolean;
}

export interface RoleAssignment {
  config: PublicKey;
  holder: PublicKey;
  role: number;
  assignedBy: PublicKey;
  assignedAt: BN;
  bump: number;
}

export interface BlacklistEntry {
  config: PublicKey;
  address: PublicKey;
  blacklistedBy: PublicKey;
  reasonHash: number[];
  createdAt: BN;
  bump: number;
}

export interface InitializeParams {
  configId: BN;
  preset: number;
  decimals: number;
  name: string;
  symbol: string;
  uri: string;
}

export interface PresetConfig {
  preset: Preset;
  hasTransferHook: boolean;
  hasPermanentDelegate: boolean;
  hasConfidentialTransfers: boolean;
  description: string;
}

export const PRESET_CONFIGS: Record<Preset, PresetConfig> = {
  [Preset.Minimal]: {
    preset: Preset.Minimal,
    hasTransferHook: false,
    hasPermanentDelegate: false,
    hasConfidentialTransfers: false,
    description: "Minimal stablecoin with basic mint/burn/freeze capabilities",
  },
  [Preset.Compliant]: {
    preset: Preset.Compliant,
    hasTransferHook: true,
    hasPermanentDelegate: true,
    hasConfidentialTransfers: false,
    description:
      "Compliant stablecoin with blacklist enforcement and asset seizure",
  },
  [Preset.Private]: {
    preset: Preset.Private,
    hasTransferHook: true,
    hasPermanentDelegate: true,
    hasConfidentialTransfers: true,
    description:
      "Privacy-enhanced stablecoin with confidential transfers and allowlists",
  },
};
