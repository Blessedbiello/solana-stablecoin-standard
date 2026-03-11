use anchor_lang::prelude::*;

use crate::state::{MinterInfo, StablecoinConfig};

#[derive(Accounts)]
pub struct GetConfig<'info> {
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler_get_config(ctx: Context<GetConfig>) -> Result<()> {
    let config = &ctx.accounts.config;
    msg!("Authority: {}", config.master_authority);
    msg!("Mint: {}", config.mint);
    msg!("Preset: {}", config.preset);
    msg!("Paused: {}", config.paused);
    msg!("Total Minted: {}", config.total_minted);
    msg!("Total Burned: {}", config.total_burned);
    msg!(
        "Supply: {}",
        config.total_minted.saturating_sub(config.total_burned)
    );
    Ok(())
}

#[derive(Accounts)]
pub struct GetMinterInfo<'info> {
    pub minter_info: Account<'info, MinterInfo>,
}

pub fn handler_get_minter(ctx: Context<GetMinterInfo>) -> Result<()> {
    let info = &ctx.accounts.minter_info;
    msg!("Minter: {}", info.minter);
    msg!("Allowance: {}", info.allowance);
    msg!("Total Minted: {}", info.total_minted);
    msg!(
        "Remaining: {}",
        info.allowance.saturating_sub(info.total_minted)
    );
    msg!("Active: {}", info.active);
    Ok(())
}
