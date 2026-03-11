use anchor_lang::prelude::*;

/// Roles available in the Solana Stablecoin Standard.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
#[repr(u8)]
pub enum Role {
    Minter = 0,
    Burner = 1,
    Blacklister = 2,
    Pauser = 3,
    Seizer = 4,
    FreezeAuth = 5,
}

impl Role {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Role::Minter),
            1 => Some(Role::Burner),
            2 => Some(Role::Blacklister),
            3 => Some(Role::Pauser),
            4 => Some(Role::Seizer),
            5 => Some(Role::FreezeAuth),
            _ => None,
        }
    }

    pub fn as_u8(&self) -> u8 {
        *self as u8
    }

    pub fn requires_sss2(&self) -> bool {
        matches!(self, Role::Blacklister | Role::Seizer)
    }

    pub fn label(&self) -> &'static str {
        match self {
            Role::Minter => "Minter",
            Role::Burner => "Burner",
            Role::Blacklister => "Blacklister",
            Role::Pauser => "Pauser",
            Role::Seizer => "Seizer",
            Role::FreezeAuth => "FreezeAuthority",
        }
    }
}

/// PDA seeds for role assignment: ["role", config, holder, role_u8].
pub fn role_seeds<'a>(
    config: &'a [u8],
    holder: &'a [u8],
    role_byte: &'a [u8],
) -> [&'a [u8]; 4] {
    [b"role", config, holder, role_byte]
}
