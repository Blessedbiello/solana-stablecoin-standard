use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::{StablecoinPaused, StablecoinUnpaused};
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct Pause<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment PDA for the Pauser role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), pauser.key().as_ref(), &[3u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,
}

pub fn handler(ctx: Context<Pause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = true;

    emit!(StablecoinPaused {
        config: config.key(),
        authority: ctx.accounts.pauser.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        constraint = config.paused @ SssError::NotPaused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment PDA for the Pauser role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), pauser.key().as_ref(), &[3u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,
}

pub fn handler_unpause(ctx: Context<Unpause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = false;

    emit!(StablecoinUnpaused {
        config: config.key(),
        authority: ctx.accounts.pauser.key(),
    });

    Ok(())
}
