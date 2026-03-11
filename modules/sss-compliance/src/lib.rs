use anchor_lang::prelude::*;

/// Preset levels for stablecoin configurations.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
#[repr(u8)]
pub enum Preset {
    /// SSS-1: Minimal — mint, burn, freeze, pause, roles.
    Minimal = 1,
    /// SSS-2: Compliant — adds transfer hook, blacklist, permanent delegate, seize.
    Compliant = 2,
    /// SSS-3: Private — adds confidential transfers and allowlists.
    Private = 3,
}

impl Preset {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            1 => Some(Preset::Minimal),
            2 => Some(Preset::Compliant),
            3 => Some(Preset::Private),
            _ => None,
        }
    }

    pub fn has_transfer_hook(&self) -> bool {
        matches!(self, Preset::Compliant | Preset::Private)
    }

    pub fn has_permanent_delegate(&self) -> bool {
        matches!(self, Preset::Compliant | Preset::Private)
    }

    pub fn has_confidential_transfers(&self) -> bool {
        matches!(self, Preset::Private)
    }
}

/// PDA seed prefix for blacklist entries.
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

/// PDA seed prefix for allowlist entries.
pub const ALLOWLIST_SEED: &[u8] = b"allowlist";

/// Derive the blacklist entry PDA.
pub fn find_blacklist_entry(
    program_id: &Pubkey,
    config: &Pubkey,
    address: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[BLACKLIST_SEED, config.as_ref(), address.as_ref()],
        program_id,
    )
}

/// Derive the allowlist entry PDA.
pub fn find_allowlist_entry(
    program_id: &Pubkey,
    config: &Pubkey,
    address: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ALLOWLIST_SEED, config.as_ref(), address.as_ref()],
        program_id,
    )
}
