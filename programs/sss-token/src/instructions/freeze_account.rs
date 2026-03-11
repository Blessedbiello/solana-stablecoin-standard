use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_lang::solana_program::program::invoke_signed;

use crate::constants::*;
use crate::error::SssError;
use crate::events::AccountFrozen;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    pub freeze_authority: Signer<'info>,

    #[account(
        has_one = mint,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Role assignment for FreezeAuth role.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), freeze_authority.key().as_ref(), &[5u8]],
        bump,
    )]
    pub role_assignment: UncheckedAccount<'info>,

    /// CHECK: Token-2022 mint.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token account to freeze.
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<FreezeAccount>) -> Result<()> {
    let config = &ctx.accounts.config;
    let authority_key = config.master_authority;
    let config_id_bytes = config.config_id.to_le_bytes();
    let config_seeds: &[&[u8]] = &[
        CONFIG_SEED,
        authority_key.as_ref(),
        &config_id_bytes,
        &[config.bump],
    ];

    invoke_signed(
        &spl_token_2022::instruction::freeze_account(
            &spl_token_2022::ID,
            &ctx.accounts.token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.config.key(),
            &[],
        )?,
        &[
            ctx.accounts.token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    emit!(AccountFrozen {
        config: config.key(),
        account: ctx.accounts.token_account.key(),
        authority: ctx.accounts.freeze_authority.key(),
    });

    Ok(())
}
