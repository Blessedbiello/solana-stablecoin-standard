use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_lang::solana_program::program::invoke_signed;

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensSeized;
use crate::state::StablecoinConfig;
use sss_compliance::Preset;

#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    #[account(
        has_one = mint,
        has_one = treasury,
        constraint = Preset::from_u8(config.preset)
            .map(|p| p.has_permanent_delegate())
            .unwrap_or(false) @ SssError::FeatureNotAvailable,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Role assignment for Seizer role.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), seizer.key().as_ref(), &[4u8]],
        bump,
    )]
    pub role_assignment: UncheckedAccount<'info>,

    /// CHECK: Token-2022 mint.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Source token account (must be frozen).
    #[account(mut)]
    pub source_token_account: UncheckedAccount<'info>,

    /// CHECK: Treasury token account.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Seize>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidParameter);

    let config = &ctx.accounts.config;
    let authority_key = config.master_authority;
    let config_id_bytes = config.config_id.to_le_bytes();
    let config_seeds: &[&[u8]] = &[
        CONFIG_SEED,
        authority_key.as_ref(),
        &config_id_bytes,
        &[config.bump],
    ];

    // Use permanent delegate to transfer from frozen account to treasury.
    // The config PDA is the permanent delegate.
    invoke_signed(
        &spl_token_2022::instruction::transfer_checked(
            &spl_token_2022::ID,
            &ctx.accounts.source_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.treasury.key(),
            &ctx.accounts.config.key(), // permanent delegate
            &[],
            amount,
            config.decimals,
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.treasury.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    emit!(TokensSeized {
        config: config.key(),
        from: ctx.accounts.source_token_account.key(),
        to_treasury: ctx.accounts.treasury.key(),
        amount,
        seized_by: ctx.accounts.seizer.key(),
    });

    Ok(())
}
