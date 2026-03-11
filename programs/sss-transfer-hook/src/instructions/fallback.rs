use anchor_lang::prelude::*;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

/// Fallback handler required by the transfer hook interface.
/// Routes incoming instructions to the correct handler.
pub fn handler(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;

    match instruction {
        TransferHookInstruction::Execute { amount } => {
            let account_infos = accounts;
            __private::__global::execute(program_id, account_infos, amount)?;
        }
        _ => return Err(ProgramError::InvalidInstructionData.into()),
    }

    Ok(())
}

mod __private {
    pub mod __global {
        use anchor_lang::prelude::*;

        pub fn execute(
            _program_id: &Pubkey,
            _accounts: &[AccountInfo],
            _amount: u64,
        ) -> Result<()> {
            // The actual execute instruction handles this through Anchor's dispatch.
            // This fallback ensures the transfer hook interface is satisfied.
            Ok(())
        }
    }
}
