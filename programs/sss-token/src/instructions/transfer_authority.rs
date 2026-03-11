use anchor_lang::prelude::*;

use crate::error::SssError;
use crate::events::{AuthorityTransferInitiated, AuthorityTransferred};
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct InitiateAuthorityTransfer<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = config.master_authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The proposed new authority.
    pub new_authority: UncheckedAccount<'info>,
}

pub fn handler_initiate(ctx: Context<InitiateAuthorityTransfer>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.pending_authority = ctx.accounts.new_authority.key();

    emit!(AuthorityTransferInitiated {
        config: config.key(),
        current_authority: ctx.accounts.authority.key(),
        pending_authority: ctx.accounts.new_authority.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        constraint = config.pending_authority == new_authority.key() @ SssError::InvalidPendingAuthority,
        constraint = config.pending_authority != Pubkey::default() @ SssError::NoAuthorityTransfer,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler_accept(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_authority = config.master_authority;
    config.master_authority = ctx.accounts.new_authority.key();
    config.pending_authority = Pubkey::default();

    emit!(AuthorityTransferred {
        config: config.key(),
        old_authority,
        new_authority: ctx.accounts.new_authority.key(),
    });

    Ok(())
}
