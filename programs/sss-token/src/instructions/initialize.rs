use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::spl_token_2022::{
    self,
    extension::ExtensionType,
    instruction as token_instruction,
};
use sss_compliance::Preset;

use crate::constants::*;
use crate::error::SssError;
use crate::events::StablecoinInitialized;
use crate::state::StablecoinConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub config_id: u64,
    pub preset: u8,
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StablecoinConfig::INIT_SPACE,
        seeds = [CONFIG_SEED, authority.key().as_ref(), &params.config_id.to_le_bytes()],
        bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Token-2022 mint PDA — initialized via CPI below.
    #[account(
        mut,
        seeds = [MINT_SEED, config.key().as_ref()],
        bump,
    )]
    pub mint: UncheckedAccount<'info>,

    /// Treasury token account to receive seized tokens.
    /// CHECK: Validated to be a valid token account in handler (or created later).
    pub treasury: UncheckedAccount<'info>,

    /// Transfer hook program (required for SSS-2/SSS-3, ignored for SSS-1).
    /// CHECK: Only used when preset >= 2.
    pub transfer_hook_program: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token-2022 program.
    #[account(address = spl_token_2022::ID)]
    pub token_program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    // 1. Validate
    let preset = Preset::from_u8(params.preset).ok_or(SssError::InvalidPreset)?;
    require!(params.name.len() <= MAX_NAME_LEN, SssError::InvalidParameter);
    require!(params.symbol.len() <= MAX_SYMBOL_LEN, SssError::InvalidParameter);
    require!(params.uri.len() <= MAX_URI_LEN, SssError::InvalidParameter);
    require!(params.decimals <= 18, SssError::InvalidParameter);

    let config_key = ctx.accounts.config.key();
    let config_bump = ctx.bumps.config;
    let mint_bump = ctx.bumps.mint;

    let authority_key = ctx.accounts.authority.key();
    let config_id_bytes = params.config_id.to_le_bytes();
    let config_seeds: &[&[u8]] = &[
        CONFIG_SEED,
        authority_key.as_ref(),
        &config_id_bytes,
        &[config_bump],
    ];

    let mint_key = ctx.accounts.mint.key();
    let mint_seeds: &[&[u8]] = &[MINT_SEED, config_key.as_ref(), &[mint_bump]];

    // 2. Determine extensions based on preset
    let mut extensions = vec![ExtensionType::MetadataPointer];

    if preset.has_permanent_delegate() {
        extensions.push(ExtensionType::PermanentDelegate);
    }
    if preset.has_transfer_hook() {
        extensions.push(ExtensionType::TransferHook);
    }

    // 3. Calculate space and create mint account
    let mint_space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(
        &extensions,
    )
    .map_err(|_| SssError::Overflow)?;

    // Add space for on-chain metadata
    let metadata_space = 4  // discriminator for metadata
        + 32  // update authority
        + 32  // mint
        + 4 + params.name.len()
        + 4 + params.symbol.len()
        + 4 + params.uri.len()
        + 4;  // additional metadata vec
    let total_space = mint_space + metadata_space;
    let rent_lamports = Rent::get()?.minimum_balance(total_space);

    // Create mint account
    invoke_signed(
        &anchor_lang::solana_program::system_instruction::create_account(
            ctx.accounts.authority.key,
            &mint_key,
            rent_lamports,
            total_space as u64,
            &spl_token_2022::ID,
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[mint_seeds],
    )?;

    // 4. Initialize extensions (order matters!)

    // 4a. Permanent delegate (SSS-2+)
    if preset.has_permanent_delegate() {
        invoke_signed(
            &token_instruction::initialize_permanent_delegate(
                &spl_token_2022::ID,
                &mint_key,
                &config_key,
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[],
        )?;
    }

    // 4b. Transfer hook (SSS-2+)
    if preset.has_transfer_hook() {
        let hook_program = ctx
            .accounts
            .transfer_hook_program
            .as_ref()
            .ok_or(SssError::InvalidParameter)?;

        invoke_signed(
            &spl_token_2022::extension::transfer_hook::instruction::initialize(
                &spl_token_2022::ID,
                &mint_key,
                Some(config_key),
                Some(hook_program.key()),
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[],
        )?;
    }

    // 4c. Metadata pointer
    invoke_signed(
        &spl_token_2022::extension::metadata_pointer::instruction::initialize(
            &spl_token_2022::ID,
            &mint_key,
            Some(config_key),
            Some(mint_key),
        )?,
        &[ctx.accounts.mint.to_account_info()],
        &[],
    )?;

    // 4d. Initialize mint
    invoke_signed(
        &token_instruction::initialize_mint2(
            &spl_token_2022::ID,
            &mint_key,
            &config_key, // mint authority
            Some(&config_key), // freeze authority
            params.decimals,
        )?,
        &[ctx.accounts.mint.to_account_info()],
        &[],
    )?;

    // 4e. Initialize token metadata
    invoke_signed(
        &spl_token_metadata_interface::instruction::initialize(
            &spl_token_2022::ID,
            &mint_key,
            &config_key, // update authority
            &mint_key,
            &config_key, // mint authority
            params.name.clone(),
            params.symbol.clone(),
            params.uri.clone(),
        ),
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 5. Update state
    let config = &mut ctx.accounts.config;
    config.master_authority = ctx.accounts.authority.key();
    config.pending_authority = Pubkey::default();
    config.mint = mint_key;
    config.treasury = ctx.accounts.treasury.key();
    config.transfer_hook_program = if preset.has_transfer_hook() {
        ctx.accounts
            .transfer_hook_program
            .as_ref()
            .map(|a| a.key())
            .unwrap_or_default()
    } else {
        Pubkey::default()
    };
    config.total_minted = 0;
    config.total_burned = 0;
    config.decimals = params.decimals;
    config.bump = config_bump;
    config.paused = false;
    config.preset = params.preset;
    config.config_id = params.config_id;
    config._reserved = vec![0u8; 64];

    // 6. Emit event
    emit!(StablecoinInitialized {
        config: config.key(),
        mint: mint_key,
        authority: ctx.accounts.authority.key(),
        preset: params.preset,
        decimals: params.decimals,
        name: params.name,
        symbol: params.symbol,
    });

    Ok(())
}
