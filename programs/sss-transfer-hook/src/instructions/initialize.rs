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
    //
    // Execute instruction fixed accounts (indices 0-4):
    //   0: source token account
    //   1: mint
    //   2: destination token account
    //   3: authority (owner/delegate)
    //   4: extra_account_metas validation account
    //
    // Extra accounts (indices 5+):
    //   5 (extra[0]): hook_config (static)
    //   6 (extra[1]): stablecoin_config (static)
    //   7 (extra[2]): sss_token_program (static — needed for external PDA derivation)
    //   8 (extra[3]): source blacklist PDA (external PDA from program at index 7)
    //   9 (extra[4]): dest blacklist PDA (external PDA from program at index 7)
    let extra_metas = vec![
        // extra[0]: hook_config — static account
        ExtraAccountMeta::new_with_pubkey(&ctx.accounts.hook_config.key(), false, false)?,
        // extra[1]: stablecoin_config — static account
        ExtraAccountMeta::new_with_pubkey(
            &ctx.accounts.stablecoin_config.key(),
            false,
            false,
        )?,
        // extra[2]: sss-token program — static (must come before derived PDAs)
        ExtraAccountMeta::new_with_pubkey(&sss_token_program_key, false, false)?,
        // extra[3]: source blacklist PDA: sss_token::find_pda(["blacklist", config, source_owner])
        // source_owner is extracted from source token account data at bytes 32..64
        ExtraAccountMeta::new_external_pda_with_seeds(
            7, // program at absolute index 7 (sss_token_program)
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 6 }, // stablecoin_config at absolute index 6
                Seed::AccountData {
                    account_index: 0, // source token account
                    data_index: 32,   // owner field offset in token account
                    length: 32,       // pubkey length
                },
            ],
            false, // is_signer
            false, // is_writable
        )?,
        // extra[4]: destination blacklist PDA: sss_token::find_pda(["blacklist", config, dest_owner])
        ExtraAccountMeta::new_external_pda_with_seeds(
            7, // program at absolute index 7 (sss_token_program)
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 6 }, // stablecoin_config at absolute index 6
                Seed::AccountData {
                    account_index: 2, // destination token account
                    data_index: 32,   // owner field offset in token account
                    length: 32,       // pubkey length
                },
            ],
            false, // is_signer
            false, // is_writable
        )?,
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
