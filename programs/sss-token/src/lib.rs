use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB");

#[program]
pub mod sss_token {
    use super::*;

    /// Initialize a new stablecoin with Token-2022 extensions based on preset.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Mint tokens to a recipient (requires Minter role + allowance).
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    /// Burn tokens from the burner's account (requires Burner role).
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    /// Freeze a token account (requires FreezeAuth role).
    pub fn freeze_account(ctx: Context<FreezeAccount>) -> Result<()> {
        instructions::freeze_account::handler(ctx)
    }

    /// Thaw a frozen token account (requires FreezeAuth role).
    pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
        instructions::thaw_account::handler(ctx)
    }

    /// Pause all operations (requires Pauser role).
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::handler(ctx)
    }

    /// Unpause operations (requires Pauser role).
    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        instructions::pause::handler_unpause(ctx)
    }

    /// Update minter allowance and active status (master authority only).
    pub fn update_minter(ctx: Context<UpdateMinter>, allowance: u64, active: bool) -> Result<()> {
        instructions::update_minter::handler(ctx, allowance, active)
    }

    /// Assign a role to a holder (master authority only).
    pub fn assign_role(ctx: Context<AssignRole>, role: u8) -> Result<()> {
        instructions::update_roles::handler_assign(ctx, role)
    }

    /// Revoke a role from a holder (master authority only).
    pub fn revoke_role(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
        instructions::update_roles::handler_revoke(ctx, role)
    }

    /// Initiate two-step authority transfer (master authority only).
    pub fn initiate_authority_transfer(ctx: Context<InitiateAuthorityTransfer>) -> Result<()> {
        instructions::transfer_authority::handler_initiate(ctx)
    }

    /// Accept pending authority transfer.
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::transfer_authority::handler_accept(ctx)
    }

    /// Add an address to the blacklist (SSS-2+, requires Blacklister role).
    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason_hash: [u8; 32]) -> Result<()> {
        instructions::blacklist::handler_add(ctx, reason_hash)
    }

    /// Remove an address from the blacklist (SSS-2+, requires Blacklister role).
    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        instructions::blacklist::handler_remove(ctx)
    }

    /// Seize tokens from a frozen account using permanent delegate (SSS-2+, requires Seizer role).
    pub fn seize<'info>(ctx: Context<'_, '_, '_, 'info, Seize<'info>>, amount: u64) -> Result<()> {
        instructions::seize::handler(ctx, amount)
    }

    /// View stablecoin configuration (permissionless).
    pub fn get_config(ctx: Context<GetConfig>) -> Result<()> {
        instructions::view::handler_get_config(ctx)
    }

    /// View minter information (permissionless).
    pub fn get_minter_info(ctx: Context<GetMinterInfo>) -> Result<()> {
        instructions::view::handler_get_minter(ctx)
    }
}
