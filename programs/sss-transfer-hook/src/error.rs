use anchor_lang::prelude::*;

#[error_code]
pub enum HookError {
    #[msg("Source address is blacklisted")]
    SourceBlacklisted = 7000,
    #[msg("Destination address is blacklisted")]
    DestinationBlacklisted,
    #[msg("Invalid extra account metas")]
    InvalidExtraAccountMetas,
}
