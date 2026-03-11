use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_lang::solana_program::program::invoke;

use crate::constants::*;
use crate::error::SssError;
use crate::events::TokensBurned;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Role assignment PDA for the Burner role — must exist.
    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), burner.key().as_ref(), &[1u8]],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, crate::state::RoleAssignment>,

    /// CHECK: Token-2022 mint account.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Burner's token account.
    #[account(mut)]
    pub burner_token_account: UncheckedAccount<'info>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    // 1. Validate
    require!(amount > 0, SssError::InvalidBurnAmount);

    // Role assignment PDA existence is validated by the seeds constraint.
    // If the PDA doesn't exist, the constraint will fail.

    // 2. CPI: burn
    invoke(
        &spl_token_2022::instruction::burn(
            &spl_token_2022::ID,
            &ctx.accounts.burner_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.burner.key(),
            &[],
            amount,
        )?,
        &[
            ctx.accounts.burner_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.burner.to_account_info(),
        ],
    )?;

    // 3. Update state
    let config = &mut ctx.accounts.config;
    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

    // 4. Emit event
    emit!(TokensBurned {
        config: config.key(),
        burner: ctx.accounts.burner.key(),
        amount,
        total_burned: config.total_burned,
    });

    Ok(())
}
