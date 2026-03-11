/// PDA seed for stablecoin configuration.
pub const CONFIG_SEED: &[u8] = b"stablecoin_config";

/// PDA seed for the token mint.
pub const MINT_SEED: &[u8] = b"sss_mint";

/// PDA seed for minter info.
pub const MINTER_SEED: &[u8] = b"minter_info";

/// PDA seed for role assignments.
pub const ROLE_SEED: &[u8] = b"role";

/// Maximum name length for the token.
pub const MAX_NAME_LEN: usize = 32;

/// Maximum symbol length for the token.
pub const MAX_SYMBOL_LEN: usize = 10;

/// Maximum URI length for metadata.
pub const MAX_URI_LEN: usize = 200;
