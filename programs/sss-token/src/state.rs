use anchor_lang::prelude::*;

/// Main configuration account for a stablecoin deployment.
#[account]
#[derive(InitSpace)]
pub struct StablecoinConfig {
    /// The master authority who can manage roles and configuration.
    pub master_authority: Pubkey,
    /// Pending authority for two-step transfer (Pubkey::default() if none).
    pub pending_authority: Pubkey,
    /// The Token-2022 mint address.
    pub mint: Pubkey,
    /// Treasury account for seized tokens.
    pub treasury: Pubkey,
    /// Transfer hook program ID (Pubkey::default() if SSS-1).
    pub transfer_hook_program: Pubkey,
    /// Cumulative tokens minted.
    pub total_minted: u64,
    /// Cumulative tokens burned.
    pub total_burned: u64,
    /// Token decimals.
    pub decimals: u8,
    /// PDA bump seed.
    pub bump: u8,
    /// Whether the stablecoin is paused.
    pub paused: bool,
    /// Preset level (1=SSS-1, 2=SSS-2, 3=SSS-3).
    pub preset: u8,
    /// Unique config identifier for multiple deployments per authority.
    pub config_id: u64,
    /// Reserved space for future upgrades.
    #[max_len(64)]
    pub _reserved: Vec<u8>,
}

/// Minter info tracking allowance and usage.
#[account]
#[derive(InitSpace)]
pub struct MinterInfo {
    /// Associated stablecoin config.
    pub config: Pubkey,
    /// Minter wallet address.
    pub minter: Pubkey,
    /// Maximum tokens this minter can mint.
    pub allowance: u64,
    /// Total tokens minted by this minter.
    pub total_minted: u64,
    /// Whether the minter is currently active.
    pub active: bool,
    /// PDA bump seed.
    pub bump: u8,
}

/// Role assignment linking a holder to a specific role.
#[account]
#[derive(InitSpace)]
pub struct RoleAssignment {
    /// Associated stablecoin config.
    pub config: Pubkey,
    /// Role holder address.
    pub holder: Pubkey,
    /// The assigned role.
    pub role: u8,
    /// Who assigned this role.
    pub assigned_by: Pubkey,
    /// Timestamp of assignment.
    pub assigned_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

/// Blacklist entry for a specific address.
#[account]
#[derive(InitSpace)]
pub struct BlacklistEntry {
    /// Associated stablecoin config.
    pub config: Pubkey,
    /// Blacklisted address.
    pub address: Pubkey,
    /// Who blacklisted this address.
    pub blacklisted_by: Pubkey,
    /// Hash of the reason (off-chain reference).
    pub reason_hash: [u8; 32],
    /// Timestamp of blacklisting.
    pub created_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

/// Allowlist entry for SSS-3 privacy feature.
#[account]
#[derive(InitSpace)]
pub struct AllowlistEntry {
    /// Associated stablecoin config.
    pub config: Pubkey,
    /// Allowed address.
    pub address: Pubkey,
    /// PDA bump seed.
    pub bump: u8,
}

/// Oracle configuration for peg monitoring.
#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    /// Associated stablecoin config.
    pub config: Pubkey,
    /// Oracle feed account (e.g., Switchboard aggregator).
    pub feed: Pubkey,
    /// Maximum staleness in seconds.
    pub max_staleness: i64,
    /// Target peg price (in feed decimals).
    pub target_peg: u64,
    /// Deviation threshold in basis points.
    pub deviation_threshold_bps: u64,
    /// PDA bump seed.
    pub bump: u8,
}
