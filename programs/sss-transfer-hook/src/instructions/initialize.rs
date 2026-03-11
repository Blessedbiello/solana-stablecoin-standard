use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};

use crate::state::*;

#[derive(Accounts)]
pub struct InitializeHook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Token-2022 mint.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Stablecoin config from the main program.
    pub stablecoin_config: UncheckedAccount<'info>,

    /// CHECK: Main SSS token program.
    pub sss_token_program: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + TransferHookConfig::INIT_SPACE,
        seeds = [HOOK_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub hook_config: Account<'info, TransferHookConfig>,

    /// CHECK: ExtraAccountMetaList PDA — initialized below.
    #[account(
        mut,
        seeds = [EXTRA_METAS_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_metas: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeHook>) -> Result<()> {
    // Store hook config
    let hook_config = &mut ctx.accounts.hook_config;
    hook_config.stablecoin_config = ctx.accounts.stablecoin_config.key();
    hook_config.mint = ctx.accounts.mint.key();
    hook_config.bump = ctx.bumps.hook_config;

    let sss_token_program_key = ctx.accounts.sss_token_program.key();

    // Define extra account metas for blacklist lookups.
    // Token-2022 will resolve these PDAs during transfer_checked.
    // Extra accounts needed:
    // 0: hook_config (static)
    // 1: stablecoin_config (static)
    // 2: source owner blacklist PDA (derived from sss-token program)
    // 3: destination owner blacklist PDA (derived from sss-token program)
    let extra_metas = vec![
        // hook_config — static account
        ExtraAccountMeta::new_with_pubkey(&ctx.accounts.hook_config.key(), false, false)?,
        // stablecoin_config — static account
        ExtraAccountMeta::new_with_pubkey(
            &ctx.accounts.stablecoin_config.key(),
            false,
            false,
        )?,
        // source blacklist PDA: ["blacklist", config, source_owner]
        // source_owner comes from resolving the owner of account at index 0 (source)
        ExtraAccountMeta::new_external_pda_with_seeds(
            0, // program index for sss_token_program
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 7 }, // stablecoin_config (extra meta index 1 -> absolute 7)
                Seed::AccountKey { index: 2 }, // source authority/owner
            ],
            false, // is_signer
            false, // is_writable
        )?,
        // destination blacklist PDA: ["blacklist", config, destination_owner]
        ExtraAccountMeta::new_external_pda_with_seeds(
            0,
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 7 }, // stablecoin_config
                Seed::AccountKey { index: 4 }, // destination authority/owner
            ],
            false, // is_signer
            false, // is_writable
        )?,
        // sss-token program for PDA derivation
        ExtraAccountMeta::new_with_pubkey(&sss_token_program_key, false, false)?,
    ];

    // Calculate space and create the extra metas account
    let metas_size = ExtraAccountMetaList::size_of(extra_metas.len())?;
    let rent_lamports = Rent::get()?.minimum_balance(metas_size);

    let mint_key = ctx.accounts.mint.key();
    let metas_bump = ctx.bumps.extra_account_metas;
    let metas_seeds: &[&[u8]] = &[EXTRA_METAS_SEED, mint_key.as_ref(), &[metas_bump]];

    invoke_signed(
        &anchor_lang::solana_program::system_instruction::create_account(
            ctx.accounts.authority.key,
            &ctx.accounts.extra_account_metas.key(),
            rent_lamports,
            metas_size as u64,
            &crate::ID,
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.extra_account_metas.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[metas_seeds],
    )?;

    // Write the extra account metas
    let mut data = ctx.accounts.extra_account_metas.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<spl_transfer_hook_interface::instruction::ExecuteInstruction>(
        &mut data,
        &extra_metas,
    )?;

    Ok(())
}
