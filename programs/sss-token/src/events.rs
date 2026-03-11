use anchor_lang::prelude::*;

#[event]
pub struct StablecoinInitialized {
    pub config: Pubkey,
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub preset: u8,
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
}

#[event]
pub struct TokensMinted {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub total_minted: u64,
    pub minter_allowance_remaining: u64,
}

#[event]
pub struct TokensBurned {
    pub config: Pubkey,
    pub burner: Pubkey,
    pub amount: u64,
    pub total_burned: u64,
}

#[event]
pub struct AccountFrozen {
    pub config: Pubkey,
    pub account: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct AccountThawed {
    pub config: Pubkey,
    pub account: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct StablecoinPaused {
    pub config: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct StablecoinUnpaused {
    pub config: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct MinterUpdated {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub allowance: u64,
    pub active: bool,
}

#[event]
pub struct RoleAssigned {
    pub config: Pubkey,
    pub holder: Pubkey,
    pub role: u8,
    pub assigned_by: Pubkey,
}

#[event]
pub struct RoleRevoked {
    pub config: Pubkey,
    pub holder: Pubkey,
    pub role: u8,
    pub revoked_by: Pubkey,
}

#[event]
pub struct AuthorityTransferInitiated {
    pub config: Pubkey,
    pub current_authority: Pubkey,
    pub pending_authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub config: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct AddressBlacklisted {
    pub config: Pubkey,
    pub address: Pubkey,
    pub blacklisted_by: Pubkey,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct AddressUnblacklisted {
    pub config: Pubkey,
    pub address: Pubkey,
    pub removed_by: Pubkey,
}

#[event]
pub struct TokensSeized {
    pub config: Pubkey,
    pub from: Pubkey,
    pub to_treasury: Pubkey,
    pub amount: u64,
    pub seized_by: Pubkey,
}
