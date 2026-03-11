use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::{RoleAssigned, RoleRevoked};
use crate::state::{RoleAssignment, StablecoinConfig};

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct AssignRole<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = config.master_authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The wallet to assign the role to.
    pub holder: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + RoleAssignment::INIT_SPACE,
        seeds = [ROLE_SEED, config.key().as_ref(), holder.key().as_ref(), &[role]],
        bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    pub system_program: Program<'info, System>,
}

pub fn handler_assign(ctx: Context<AssignRole>, role: u8) -> Result<()> {
    // Validate role
    sss_roles::Role::from_u8(role).ok_or(SssError::InvalidParameter)?;

    // Check if role requires SSS-2
    let preset = sss_compliance::Preset::from_u8(ctx.accounts.config.preset)
        .ok_or(SssError::InvalidPreset)?;
    if let Some(r) = sss_roles::Role::from_u8(role) {
        if r.requires_sss2() && !preset.has_transfer_hook() {
            return Err(SssError::FeatureNotAvailable.into());
        }
    }

    let assignment = &mut ctx.accounts.role_assignment;
    assignment.config = ctx.accounts.config.key();
    assignment.holder = ctx.accounts.holder.key();
    assignment.role = role;
    assignment.assigned_by = ctx.accounts.authority.key();
    assignment.assigned_at = Clock::get()?.unix_timestamp;
    assignment.bump = ctx.bumps.role_assignment;

    emit!(RoleAssigned {
        config: ctx.accounts.config.key(),
        holder: ctx.accounts.holder.key(),
        role,
        assigned_by: ctx.accounts.authority.key(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct RevokeRole<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = config.master_authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The wallet whose role is being revoked.
    pub holder: UncheckedAccount<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [ROLE_SEED, config.key().as_ref(), holder.key().as_ref(), &[role]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,
}

pub fn handler_revoke(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
    emit!(RoleRevoked {
        config: ctx.accounts.config.key(),
        holder: ctx.accounts.holder.key(),
        role,
        revoked_by: ctx.accounts.authority.key(),
    });

    Ok(())
}
