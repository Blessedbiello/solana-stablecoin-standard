use anchor_lang::prelude::*;

#[error_code]
pub enum SssError {
    // Core errors: 6000-6009
    #[msg("Unauthorized: caller does not have the required role")]
    Unauthorized = 6000,
    #[msg("Stablecoin is currently paused")]
    Paused,
    #[msg("Stablecoin is not paused")]
    NotPaused,
    #[msg("Invalid preset value")]
    InvalidPreset,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid parameter")]
    InvalidParameter,
    #[msg("Authority transfer not initiated")]
    NoAuthorityTransfer,
    #[msg("Invalid pending authority")]
    InvalidPendingAuthority,
    #[msg("Feature not available for this preset")]
    FeatureNotAvailable,
    #[msg("Account already initialized")]
    AlreadyInitialized,

    // Minter errors: 6010-6019
    #[msg("Minter allowance exceeded")]
    AllowanceExceeded = 6010,
    #[msg("Minter is not active")]
    MinterInactive,
    #[msg("Invalid mint amount — must be greater than zero")]
    InvalidMintAmount,
    #[msg("Invalid burn amount — must be greater than zero")]
    InvalidBurnAmount,
    #[msg("Insufficient balance for burn")]
    InsufficientBalance,

    // Compliance errors: 6020-6029
    #[msg("Address is blacklisted")]
    Blacklisted = 6020,
    #[msg("Address is not blacklisted")]
    NotBlacklisted,
    #[msg("Cannot seize from non-frozen account")]
    AccountNotFrozen,
    #[msg("Seize amount exceeds frozen balance")]
    SeizeExceedsBalance,
    #[msg("Transfer hook check failed — blacklisted participant")]
    TransferHookBlacklisted,

    // Privacy errors: 6030-6039
    #[msg("Address is not on the allowlist")]
    NotOnAllowlist = 6030,
    #[msg("Address already on the allowlist")]
    AlreadyOnAllowlist,
    #[msg("Confidential transfers not enabled")]
    ConfidentialTransfersDisabled,

    // Oracle errors: 6040-6049
    #[msg("Oracle feed is stale")]
    OracleFeedStale = 6040,
    #[msg("Price deviates beyond threshold")]
    PriceDeviationExceeded,
    #[msg("Invalid oracle configuration")]
    InvalidOracleConfig,
}
