use anchor_lang::prelude::*;

use crate::error::HookError;
use crate::state::*;

/// Execute transfer hook — checks blacklist PDAs for source and destination.
///
/// Token-2022 calls this during `transfer_checked` when a transfer hook is configured.
/// The extra account metas resolved by Token-2022 include blacklist PDA addresses.
/// If a blacklist PDA exists (has data), the transfer is rejected.
#[derive(Accounts)]
pub struct Execute<'info> {
    /// CHECK: Source token account (provided by Token-2022).
    pub source: UncheckedAccount<'info>,
    /// CHECK: Token-2022 mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Destination token account.
    pub destination: UncheckedAccount<'info>,
    /// CHECK: Source owner/authority.
    pub source_authority: UncheckedAccount<'info>,
    /// CHECK: Extra account metas list.
    pub extra_account_metas: UncheckedAccount<'info>,

    // Extra accounts resolved by Token-2022 (must match ExtraAccountMetaList order):
    /// CHECK: Hook config account.
    pub hook_config: Account<'info, TransferHookConfig>,
    /// CHECK: Stablecoin config.
    pub stablecoin_config: UncheckedAccount<'info>,
    /// CHECK: SSS token program (for PDA derivation).
    pub sss_token_program: UncheckedAccount<'info>,
    /// CHECK: Source blacklist PDA (may not exist).
    pub source_blacklist: UncheckedAccount<'info>,
    /// CHECK: Destination blacklist PDA (may not exist).
    pub destination_blacklist: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Execute>, _amount: u64) -> Result<()> {
    // Check if source is blacklisted by verifying the PDA has data
    let source_bl = &ctx.accounts.source_blacklist;
    if source_bl.data_len() > 0 {
        return Err(HookError::SourceBlacklisted.into());
    }

    // Check if destination is blacklisted
    let dest_bl = &ctx.accounts.destination_blacklist;
    if dest_bl.data_len() > 0 {
        return Err(HookError::DestinationBlacklisted.into());
    }

    Ok(())
}
