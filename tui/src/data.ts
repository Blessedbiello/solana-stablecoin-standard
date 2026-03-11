/**
 * Data provider for the SSS TUI dashboard.
 *
 * Exports:
 *   - DashboardData   — unified shape consumed by the dashboard renderer
 *   - getMockData()   — realistic demo data, used when no validator is available
 *   - fetchLiveData() — attempts to read real on-chain accounts; falls back to
 *                       mock data on any connection or decode error
 *
 * PDA derivation is self-contained so this file has zero dependency on the SDK.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Seeds — mirrors programs/sss-token/src/constants.rs
// ---------------------------------------------------------------------------

const CONFIG_SEED = Buffer.from("stablecoin_config");
const MINTER_SEED = Buffer.from("minter_info");
const ROLE_SEED = Buffer.from("role");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ClusterName = "localnet" | "devnet" | "mainnet";

export enum Preset {
  Minimal = 1,
  Compliant = 2,
  Private = 3,
}

export const PRESET_LABELS: Record<number, string> = {
  1: "SSS-1 Minimal",
  2: "SSS-2 Compliant",
  3: "SSS-3 Private",
};

export const ROLE_LABELS: Record<number, string> = {
  0: "Minter",
  1: "Burner",
  2: "Blacklister",
  3: "Pauser",
  4: "Seizer",
  5: "FreezeAuth",
};

export interface SupplyInfo {
  /** Raw on-chain value (u64). Divide by 10^decimals for UI display. */
  totalMinted: bigint;
  totalBurned: bigint;
  /** Circulating = totalMinted - totalBurned. */
  circulating: bigint;
  decimals: number;
  /** Percentage of circulating / totalMinted in [0, 100]. */
  circulatingPct: number;
}

export interface ConfigInfo {
  address: string;
  mintAddress: string;
  authority: string;
  pendingAuthority: string | null;
  preset: number;
  decimals: number;
  paused: boolean;
  configId: string;
  hasTransferHook: boolean;
}

export interface RecentEvent {
  type: string;
  timestamp: string;
  details: string;
}

export interface RoleRow {
  role: string;
  holder: string;
  assignedBy: string;
  assignedAt: string;
}

export interface MinterRow {
  address: string;
  /** Human-readable (already divided by decimals). */
  allowance: string;
  minted: string;
  /** Remaining allowance as a percentage of allowance. */
  usedPct: string;
  active: string;
}

export interface DashboardData {
  supply: SupplyInfo;
  config: ConfigInfo;
  events: RecentEvent[];
  roles: RoleRow[];
  minters: MinterRow[];
  /** True when data was read from chain, false when using mock values. */
  isLive: boolean;
  /** ISO string of the last refresh. */
  lastRefreshed: string;
  /** Error message if last fetch failed, null otherwise. */
  fetchError: string | null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Format a bigint token amount with the correct decimal places. */
function fmtTokens(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toLocaleString();
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fracStr}`;
}

/** Truncate a base58 address to "ABCD...WXYZ" form. */
function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/** Format a Unix timestamp (seconds) as a locale date-time string. */
function fmtTimestamp(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/**
 * Returns realistic demo data that renders well without a running validator.
 * Amounts are denominated in USDS with 6 decimals (matching USDC convention).
 */
export function getMockData(): DashboardData {
  const totalMinted = 5_250_000_000_000n; // 5,250,000.00 USDS
  const totalBurned = 312_500_000_000n; //   312,500.00 USDS
  const circulating = totalMinted - totalBurned;
  const decimals = 6;
  const circulatingPct = Number((circulating * 10000n) / totalMinted) / 100;

  const supply: SupplyInfo = {
    totalMinted,
    totalBurned,
    circulating,
    decimals,
    circulatingPct,
  };

  const config: ConfigInfo = {
    address: "Cfg1demo1111111111111111111111111111111111",
    mintAddress: "MNTdemo11111111111111111111111111111111111",
    authority: "Auth1demo1111111111111111111111111111111111",
    pendingAuthority: null,
    preset: 2,
    decimals,
    paused: false,
    configId: "0",
    hasTransferHook: true,
  };

  const now = Math.floor(Date.now() / 1000);

  const events: RecentEvent[] = [
    {
      type: "TokensMinted",
      timestamp: fmtTimestamp(now - 120),
      details: "Minted 250,000.00 USDS to Recv1...AbCd",
    },
    {
      type: "TokensBurned",
      timestamp: fmtTimestamp(now - 300),
      details: "Burned 12,500.00 USDS by Mnt1...XyZw",
    },
    {
      type: "RoleAssigned",
      timestamp: fmtTimestamp(now - 900),
      details: "Role Minter assigned to Mnt2...5678",
    },
    {
      type: "AddressBlacklisted",
      timestamp: fmtTimestamp(now - 1800),
      details: "Blacklisted Addr...bad1 by Blk1...auth",
    },
    {
      type: "MinterUpdated",
      timestamp: fmtTimestamp(now - 3600),
      details: "Minter Mnt3...9abc allowance set to 1,000,000",
    },
    {
      type: "StablecoinInitialized",
      timestamp: fmtTimestamp(now - 86400),
      details: "Config initialized — preset SSS-2, decimals 6",
    },
  ];

  const roles: RoleRow[] = [
    {
      role: "Minter",
      holder: "Mnt1...AbCd",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 86400),
    },
    {
      role: "Minter",
      holder: "Mnt2...EfGh",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 82800),
    },
    {
      role: "Burner",
      holder: "Brn1...IjKl",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 79200),
    },
    {
      role: "Blacklister",
      holder: "Blk1...MnOp",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 75600),
    },
    {
      role: "Pauser",
      holder: "Psr1...QrSt",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 72000),
    },
    {
      role: "Seizer",
      holder: "Szr1...UvWx",
      assignedBy: "Auth...1234",
      assignedAt: fmtTimestamp(now - 68400),
    },
  ];

  const minters: MinterRow[] = [
    {
      address: "Mnt1...AbCd",
      allowance: "2,000,000.00",
      minted: "1,500,000.00",
      usedPct: "75%",
      active: "YES",
    },
    {
      address: "Mnt2...EfGh",
      allowance: "1,000,000.00",
      minted: "750,000.00",
      usedPct: "75%",
      active: "YES",
    },
    {
      address: "Mnt3...9abc",
      allowance: "1,000,000.00",
      minted: "0.00",
      usedPct: "0%",
      active: "YES",
    },
    {
      address: "Mnt4...XyZw",
      allowance: "500,000.00",
      minted: "500,000.00",
      usedPct: "100%",
      active: "NO",
    },
  ];

  return {
    supply,
    config,
    events,
    roles,
    minters,
    isLive: false,
    lastRefreshed: new Date().toISOString(),
    fetchError: null,
  };
}

// ---------------------------------------------------------------------------
// Live data fetcher
// ---------------------------------------------------------------------------

/**
 * Borsh account discriminator length (8 bytes) prepended by Anchor.
 * We skip it when reading raw account data.
 */
const DISCRIMINATOR_LEN = 8;

/** Read a u8 from a Buffer at the given offset. */
function readU8(buf: Buffer, offset: number): number {
  return buf.readUInt8(offset);
}

/** Read a u64 LE from a Buffer at the given offset as a bigint. */
function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

/** Read a i64 LE from a Buffer at the given offset as a bigint. */
function readI64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

/** Read a 32-byte Pubkey from a Buffer at the given offset. */
function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.slice(offset, offset + 32));
}

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/**
 * Decode a raw StablecoinConfig account buffer (post discriminator).
 *
 * Layout (matches Anchor/Borsh encoding of state.rs):
 *   master_authority [32]
 *   pending_authority [32]
 *   mint [32]
 *   treasury [32]
 *   transfer_hook_program [32]
 *   total_minted [8]
 *   total_burned [8]
 *   decimals [1]
 *   bump [1]
 *   paused [1]
 *   preset [1]
 *   config_id [8]
 *   _reserved (vec: 4-byte len prefix + up to 64 bytes)
 */
function decodeConfigAccount(data: Buffer): {
  masterAuthority: PublicKey;
  pendingAuthority: PublicKey;
  mint: PublicKey;
  treasury: PublicKey;
  transferHookProgram: PublicKey;
  totalMinted: bigint;
  totalBurned: bigint;
  decimals: number;
  bump: number;
  paused: boolean;
  preset: number;
  configId: bigint;
} {
  let o = DISCRIMINATOR_LEN;
  const masterAuthority = readPubkey(data, o); o += 32;
  const pendingAuthority = readPubkey(data, o); o += 32;
  const mint = readPubkey(data, o); o += 32;
  const treasury = readPubkey(data, o); o += 32;
  const transferHookProgram = readPubkey(data, o); o += 32;
  const totalMinted = readU64(data, o); o += 8;
  const totalBurned = readU64(data, o); o += 8;
  const decimals = readU8(data, o); o += 1;
  const bump = readU8(data, o); o += 1;
  const paused = readU8(data, o) !== 0; o += 1;
  const preset = readU8(data, o); o += 1;
  const configId = readU64(data, o);
  return {
    masterAuthority,
    pendingAuthority,
    mint,
    treasury,
    transferHookProgram,
    totalMinted,
    totalBurned,
    decimals,
    bump,
    paused,
    preset,
    configId,
  };
}

/**
 * Decode a raw MinterInfo account buffer (post discriminator).
 *
 * Layout:
 *   config [32]
 *   minter [32]
 *   allowance [8]
 *   total_minted [8]
 *   active [1]
 *   bump [1]
 */
function decodeMinterAccount(data: Buffer): {
  config: PublicKey;
  minter: PublicKey;
  allowance: bigint;
  totalMinted: bigint;
  active: boolean;
  bump: number;
} {
  let o = DISCRIMINATOR_LEN;
  const config = readPubkey(data, o); o += 32;
  const minter = readPubkey(data, o); o += 32;
  const allowance = readU64(data, o); o += 8;
  const totalMinted = readU64(data, o); o += 8;
  const active = readU8(data, o) !== 0; o += 1;
  const bump = readU8(data, o);
  return { config, minter, allowance, totalMinted, active, bump };
}

/**
 * Decode a raw RoleAssignment account buffer (post discriminator).
 *
 * Layout:
 *   config [32]
 *   holder [32]
 *   role [1]
 *   assigned_by [32]
 *   assigned_at [8]
 *   bump [1]
 */
function decodeRoleAccount(data: Buffer): {
  config: PublicKey;
  holder: PublicKey;
  role: number;
  assignedBy: PublicKey;
  assignedAt: bigint;
  bump: number;
} {
  let o = DISCRIMINATOR_LEN;
  const config = readPubkey(data, o); o += 32;
  const holder = readPubkey(data, o); o += 32;
  const role = readU8(data, o); o += 1;
  const assignedBy = readPubkey(data, o); o += 32;
  const assignedAt = readI64(data, o); o += 8;
  const bump = readU8(data, o);
  return { config, holder, role, assignedBy, assignedAt, bump };
}

/**
 * Attempt to fetch live data from a Solana cluster.
 *
 * On any failure the function logs the error and returns mock data with
 * `isLive: false` and `fetchError` populated.
 *
 * @param connection    Active Connection instance (may be unreachable).
 * @param programId     sss-token program ID.
 * @param configAddress The StablecoinConfig PDA address to inspect.
 */
export async function fetchLiveData(
  connection: Connection,
  programId: PublicKey,
  configAddress: PublicKey
): Promise<DashboardData> {
  try {
    // ------------------------------------------------------------------
    // 1. Fetch and decode the config account
    // ------------------------------------------------------------------
    const configAccountInfo = await connection.getAccountInfo(configAddress, {
      commitment: "confirmed",
    });

    if (!configAccountInfo) {
      throw new Error(
        `Config account not found: ${configAddress.toBase58()}`
      );
    }

    const raw = configAccountInfo.data as Buffer;
    const decoded = decodeConfigAccount(raw);

    const { decimals } = decoded;
    const totalMinted = decoded.totalMinted;
    const totalBurned = decoded.totalBurned;
    const circulating = totalMinted - totalBurned;
    const circulatingPct =
      totalMinted === 0n
        ? 0
        : Number((circulating * 10000n) / totalMinted) / 100;

    const supply: SupplyInfo = {
      totalMinted,
      totalBurned,
      circulating,
      decimals,
      circulatingPct,
    };

    const pendingAuth = decoded.pendingAuthority.toBase58();
    const config: ConfigInfo = {
      address: configAddress.toBase58(),
      mintAddress: decoded.mint.toBase58(),
      authority: decoded.masterAuthority.toBase58(),
      pendingAuthority: pendingAuth === SYSTEM_PROGRAM ? null : pendingAuth,
      preset: decoded.preset,
      decimals,
      paused: decoded.paused,
      configId: decoded.configId.toString(),
      hasTransferHook:
        decoded.transferHookProgram.toBase58() !== SYSTEM_PROGRAM,
    };

    // ------------------------------------------------------------------
    // 2. Fetch minter accounts via getProgramAccounts with a memcmp filter
    //    on the config field (bytes 8..40 in the account data).
    // ------------------------------------------------------------------
    const minterAccounts = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: DISCRIMINATOR_LEN, // config pubkey starts after discriminator
            bytes: configAddress.toBase58(),
            encoding: "base58",
          },
        },
        // DataSize filter: MinterInfo = 8 + 32+32+8+8+1+1 = 90 bytes
        { dataSize: 90 },
      ],
    });

    const minters: MinterRow[] = minterAccounts.map(({ account }) => {
      const m = decodeMinterAccount(account.data as Buffer);
      const allowance = m.allowance;
      const minted = m.totalMinted;
      const usedPct =
        allowance === 0n
          ? "N/A"
          : `${Math.round(Number((minted * 100n) / allowance))}%`;
      return {
        address: truncateAddress(m.minter.toBase58()),
        allowance: fmtTokens(allowance, decimals),
        minted: fmtTokens(minted, decimals),
        usedPct,
        active: m.active ? "YES" : "NO",
      };
    });

    // ------------------------------------------------------------------
    // 3. Fetch role assignment accounts with a similar config memcmp filter.
    //    RoleAssignment discriminator is different; dataSize = 8+32+32+1+32+8+1 = 114
    // ------------------------------------------------------------------
    const roleAccounts = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: DISCRIMINATOR_LEN,
            bytes: configAddress.toBase58(),
            encoding: "base58",
          },
        },
        { dataSize: 114 },
      ],
    });

    const roles: RoleRow[] = roleAccounts.map(({ account }) => {
      const r = decodeRoleAccount(account.data as Buffer);
      return {
        role: ROLE_LABELS[r.role] ?? `Role(${r.role})`,
        holder: truncateAddress(r.holder.toBase58()),
        assignedBy: truncateAddress(r.assignedBy.toBase58()),
        assignedAt: fmtTimestamp(Number(r.assignedAt)),
      };
    });

    // ------------------------------------------------------------------
    // 4. Events — Solana does not persist logs beyond a slot window.
    //    We show a placeholder row directing the user to the indexer.
    // ------------------------------------------------------------------
    const events: RecentEvent[] = [
      {
        type: "INFO",
        timestamp: new Date().toLocaleString(),
        details:
          "Live event streaming requires the SSS indexer backend (Phase 7).",
      },
    ];

    return {
      supply,
      config,
      events,
      roles,
      minters,
      isLive: true,
      lastRefreshed: new Date().toISOString(),
      fetchError: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const mock = getMockData();
    return {
      ...mock,
      isLive: false,
      lastRefreshed: new Date().toISOString(),
      fetchError: message,
    };
  }
}
