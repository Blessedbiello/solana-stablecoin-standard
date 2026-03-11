use anchor_lang::prelude::*;

/// Oracle feed configuration seed.
pub const ORACLE_CONFIG_SEED: &[u8] = b"oracle_config";

/// Derive the oracle config PDA.
pub fn find_oracle_config(
    program_id: &Pubkey,
    config: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ORACLE_CONFIG_SEED, config.as_ref()],
        program_id,
    )
}

/// Validate feed staleness: returns true if fresh.
pub fn is_feed_fresh(last_updated: i64, current_time: i64, max_staleness: i64) -> bool {
    current_time.saturating_sub(last_updated) <= max_staleness
}
