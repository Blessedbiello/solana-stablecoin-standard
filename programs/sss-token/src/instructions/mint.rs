use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_lang::solana_program::program::invoke_signed;

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensMinted;
use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump = minter_info.bump,
        constraint = minter_info.active @ SssError::MinterInactive,
    )]
    pub minter_info: Account<'info, MinterInfo>,

    /// CHECK: Token-2022 mint account.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Recipient's Token-2022 token account.
    #[account(mut)]
    pub recipient_token_account: UncheckedAccount<'info>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    // 1. Validate
    require!(amount > 0, SssError::InvalidMintAmount);

    let minter_info = &ctx.accounts.minter_info;
    let remaining_allowance = minter_info
        .allowance
        .checked_sub(minter_info.total_minted)
        .ok_or(SssError::Overflow)?;
    require!(amount <= remaining_allowance, SssError::AllowanceExceeded);

    // 2. Build signer seeds
    let config = &ctx.accounts.config;
    let authority_key = config.master_authority;
    let config_id_bytes = config.config_id.to_le_bytes();
    let config_seeds: &[&[u8]] = &[
        CONFIG_SEED,
        authority_key.as_ref(),
        &config_id_bytes,
        &[config.bump],
    ];

    // 3. CPI: mint_to
    invoke_signed(
        &spl_token_2022::instruction::mint_to(
            &spl_token_2022::ID,
            &ctx.accounts.mint.key(),
            &ctx.accounts.recipient_token_account.key(),
            &ctx.accounts.config.key(),
            &[],
            amount,
        )?,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.recipient_token_account.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 4. Update state
    let minter_info = &mut ctx.accounts.minter_info;
    minter_info.total_minted = minter_info
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

    let config = &mut ctx.accounts.config;
    config.total_minted = config
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

    // 5. Emit event
    emit!(TokensMinted {
        config: config.key(),
        minter: ctx.accounts.minter.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        total_minted: config.total_minted,
        minter_allowance_remaining: minter_info.allowance - minter_info.total_minted,
    });

    Ok(())
}
