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
        constraint = Preset::from_u8(config.preset)
            .map(|p| p.has_permanent_delegate())
            .unwrap_or(false) @ SssError::FeatureNotAvailable,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment for Seizer role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), seizer.key().as_ref(), &[4u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,

    /// CHECK: Token-2022 mint.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Source token account (must be frozen).
    #[account(mut)]
    pub source_token_account: UncheckedAccount<'info>,

    /// CHECK: Treasury/destination token account.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler<'info>(ctx: Context<'_, '_, '_, 'info, Seize<'info>>, amount: u64) -> Result<()> {
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

    let mint_key = ctx.accounts.mint.key();
    let source_key = ctx.accounts.source_token_account.key();
    let config_key = ctx.accounts.config.key();

    // Seize flow: thaw → transfer → re-freeze
    // Config PDA is both freeze authority and permanent delegate.

    // 1. Thaw the frozen account
    invoke_signed(
        &spl_token_2022::instruction::thaw_account(
            &spl_token_2022::ID,
            &source_key,
            &mint_key,
            &config_key,
            &[],
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 2. Transfer using permanent delegate
    // For SSS-2 mints with transfer hooks, we need to include extra accounts
    // from remaining_accounts so Token-2022 can invoke the hook.
    // The instruction must list all accounts (not just account_infos) because
    // the runtime only passes accounts referenced in the instruction to the CPI target.
    let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
        &spl_token_2022::ID,
        &source_key,
        &mint_key,
        &ctx.accounts.treasury.key(),
        &config_key,
        &[],
        amount,
        config.decimals,
    )?;

    // Add remaining accounts to BOTH the instruction and account_infos
    let mut account_infos = vec![
        ctx.accounts.source_token_account.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        ctx.accounts.config.to_account_info(),
    ];
    for remaining in ctx.remaining_accounts {
        transfer_ix.accounts.push(anchor_lang::solana_program::instruction::AccountMeta {
            pubkey: remaining.key(),
            is_signer: remaining.is_signer,
            is_writable: remaining.is_writable,
        });
        account_infos.push(remaining.to_account_info());
    }

    invoke_signed(&transfer_ix, &account_infos, &[config_seeds])?;

    // 3. Re-freeze the account
    invoke_signed(
        &spl_token_2022::instruction::freeze_account(
            &spl_token_2022::ID,
            &source_key,
            &mint_key,
            &config_key,
            &[],
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    emit!(TokensSeized {
        config: config.key(),
        from: source_key,
        to_treasury: ctx.accounts.treasury.key(),
        amount,
        seized_by: ctx.accounts.seizer.key(),
    });

    Ok(())
}
