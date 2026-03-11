use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::MinterUpdated;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
pub struct UpdateMinter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = config.master_authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The minter's wallet address.
    pub minter: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + MinterInfo::INIT_SPACE,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub minter_info: Account<'info, MinterInfo>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateMinter>, allowance: u64, active: bool) -> Result<()> {
    let minter_info = &mut ctx.accounts.minter_info;

    // Initialize if new
    if minter_info.config == Pubkey::default() {
        minter_info.config = ctx.accounts.config.key();
        minter_info.minter = ctx.accounts.minter.key();
        minter_info.total_minted = 0;
        minter_info.bump = ctx.bumps.minter_info;
    }

    minter_info.allowance = allowance;
    minter_info.active = active;

    emit!(MinterUpdated {
        config: ctx.accounts.config.key(),
        minter: ctx.accounts.minter.key(),
        allowance,
        active,
    });

    Ok(())
}
