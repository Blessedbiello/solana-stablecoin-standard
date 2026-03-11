use anchor_lang::prelude::*;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

use crate::error::HookError;

/// Fallback handler required by the transfer hook interface.
/// Routes incoming instructions to the correct handler.
///
/// When Token-2022 invokes the transfer hook during transfer_checked,
/// it uses the spl-transfer-hook-interface format (not Anchor's discriminator).
/// This fallback catches those calls and performs the blacklist check.
pub fn handler(_program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;

    match instruction {
        TransferHookInstruction::Execute { .. } => {
            // Account layout (matches ExtraAccountMetaList order):
            //   0: source token account
            //   1: mint
            //   2: destination token account
            //   3: authority (owner/delegate)
            //   4: extra_account_metas validation account
            //   5: hook_config (extra[0])
            //   6: stablecoin_config (extra[1])
            //   7: sss_token_program (extra[2])
            //   8: source_blacklist PDA (extra[3])
            //   9: dest_blacklist PDA (extra[4])

            if accounts.len() < 10 {
                return Err(ProgramError::NotEnoughAccountKeys.into());
            }

            let source_blacklist = &accounts[8];
            let dest_blacklist = &accounts[9];

            // If a blacklist PDA exists (has data), the address is blacklisted
            if source_blacklist.data_len() > 0 {
                return Err(HookError::SourceBlacklisted.into());
            }
            if dest_blacklist.data_len() > 0 {
                return Err(HookError::DestinationBlacklisted.into());
            }

            Ok(())
        }
        _ => Err(ProgramError::InvalidInstructionData.into()),
    }
}
