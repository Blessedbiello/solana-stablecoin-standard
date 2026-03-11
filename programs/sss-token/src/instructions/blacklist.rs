use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::{AddressBlacklisted, AddressUnblacklisted};
use crate::state::{BlacklistEntry, StablecoinConfig};
use sss_compliance::{Preset, BLACKLIST_SEED};

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        constraint = Preset::from_u8(config.preset)
            .map(|p| p.has_transfer_hook())
            .unwrap_or(false) @ SssError::FeatureNotAvailable,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment for Blacklister role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), blacklister.key().as_ref(), &[2u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,

    /// CHECK: The address to blacklist.
    pub address: UncheckedAccount<'info>,

    #[account(
        init,
        payer = blacklister,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler_add(ctx: Context<AddToBlacklist>, reason_hash: [u8; 32]) -> Result<()> {
    let entry = &mut ctx.accounts.blacklist_entry;
    entry.config = ctx.accounts.config.key();
    entry.address = ctx.accounts.address.key();
    entry.blacklisted_by = ctx.accounts.blacklister.key();
    entry.reason_hash = reason_hash;
    entry.created_at = Clock::get()?.unix_timestamp;
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(AddressBlacklisted {
        config: ctx.accounts.config.key(),
        address: ctx.accounts.address.key(),
        blacklisted_by: ctx.accounts.blacklister.key(),
        reason_hash,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        constraint = Preset::from_u8(config.preset)
            .map(|p| p.has_transfer_hook())
            .unwrap_or(false) @ SssError::FeatureNotAvailable,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment for Blacklister role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), blacklister.key().as_ref(), &[2u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,

    /// CHECK: The address to remove from blacklist.
    pub address: UncheckedAccount<'info>,

    #[account(
        mut,
        close = blacklister,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.key().as_ref()],
        bump = blacklist_entry.bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler_remove(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
    emit!(AddressUnblacklisted {
        config: ctx.accounts.config.key(),
        address: ctx.accounts.address.key(),
        removed_by: ctx.accounts.blacklister.key(),
    });

    Ok(())
}
