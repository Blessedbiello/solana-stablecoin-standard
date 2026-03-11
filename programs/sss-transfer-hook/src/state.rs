use anchor_lang::prelude::*;

/// Configuration linking a transfer hook instance to its stablecoin config.
#[account]
#[derive(InitSpace)]
pub struct TransferHookConfig {
    /// The stablecoin config this hook serves.
    pub stablecoin_config: Pubkey,
    /// The Token-2022 mint.
    pub mint: Pubkey,
    /// PDA bump seed.
    pub bump: u8,
}

/// Seeds for the hook config PDA.
pub const HOOK_CONFIG_SEED: &[u8] = b"hook_config";

/// Seeds for the extra account metas list (required by Token-2022 spec).
pub const EXTRA_METAS_SEED: &[u8] = b"extra-account-metas";
