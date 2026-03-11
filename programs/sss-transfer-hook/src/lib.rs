use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV");

#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the transfer hook with extra account metas for blacklist checking.
    pub fn initialize_hook(ctx: Context<InitializeHook>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Execute transfer hook — validates source and destination are not blacklisted.
    /// Uses the spl-transfer-hook-interface discriminator so Token-2022 can invoke it.
    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        instructions::execute::handler(ctx, amount)
    }
}
