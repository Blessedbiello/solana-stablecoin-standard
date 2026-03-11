# Error Code Reference

## Overview

The Solana Stablecoin Standard defines custom error codes in two programs. Anchor assigns error codes starting from 6000 for the main program.

## sss-token Errors

### Core Errors (6000-6009)

| Code | Name | Message | Cause |
|---|---|---|---|
| 6000 | `Unauthorized` | Unauthorized: caller does not have the required role | Signer is not the master authority for an authority-only instruction |
| 6001 | `Paused` | Stablecoin is currently paused | Attempted a paused-blocked operation (mint, burn, freeze) while paused |
| 6002 | `NotPaused` | Stablecoin is not paused | Attempted to unpause when already unpaused |
| 6003 | `InvalidPreset` | Invalid preset value | Preset value is not 1, 2, or 3 |
| 6004 | `Overflow` | Arithmetic overflow | A checked arithmetic operation overflowed |
| 6005 | `InvalidParameter` | Invalid parameter | Generic parameter validation failure (e.g., name too long, decimals > 18) |
| 6006 | `NoAuthorityTransfer` | Authority transfer not initiated | Attempted to accept authority when no transfer is pending |
| 6007 | `InvalidPendingAuthority` | Invalid pending authority | Signer does not match the pending authority |
| 6008 | `FeatureNotAvailable` | Feature not available for this preset | Attempted to use SSS-2+ feature on SSS-1 (e.g., blacklist, seize) |
| 6009 | `AlreadyInitialized` | Account already initialized | Attempted to initialize an account that already exists |

### Minter Errors (6010-6019)

| Code | Name | Message | Cause |
|---|---|---|---|
| 6010 | `AllowanceExceeded` | Minter allowance exceeded | Mint amount would exceed minter's remaining allowance |
| 6011 | `MinterInactive` | Minter is not active | Minter's `active` flag is false |
| 6012 | `InvalidMintAmount` | Invalid mint amount -- must be greater than zero | Attempted to mint 0 tokens |
| 6013 | `InvalidBurnAmount` | Invalid burn amount -- must be greater than zero | Attempted to burn 0 tokens |
| 6014 | `InsufficientBalance` | Insufficient balance for burn | Burn amount exceeds token account balance |

### Compliance Errors (6020-6029)

| Code | Name | Message | Cause |
|---|---|---|---|
| 6020 | `Blacklisted` | Address is blacklisted | Address has a blacklist entry PDA |
| 6021 | `NotBlacklisted` | Address is not blacklisted | Attempted to remove from blacklist, but no entry exists |
| 6022 | `AccountNotFrozen` | Cannot seize from non-frozen account | Seize target account is not frozen |
| 6023 | `SeizeExceedsBalance` | Seize amount exceeds frozen balance | Attempted to seize more tokens than the account holds |
| 6024 | `TransferHookBlacklisted` | Transfer hook check failed -- blacklisted participant | Transfer hook detected a blacklisted source or destination |

### Privacy Errors (6030-6039)

| Code | Name | Message | Cause |
|---|---|---|---|
| 6030 | `NotOnAllowlist` | Address is not on the allowlist | Address does not have an allowlist entry (SSS-3) |
| 6031 | `AlreadyOnAllowlist` | Address already on the allowlist | Attempted to add address that is already allowlisted |
| 6032 | `ConfidentialTransfersDisabled` | Confidential transfers not enabled | Attempted confidential transfer on non-SSS-3 preset |

### Oracle Errors (6040-6049)

| Code | Name | Message | Cause |
|---|---|---|---|
| 6040 | `OracleFeedStale` | Oracle feed is stale | Feed has not been updated within max_staleness window |
| 6041 | `PriceDeviationExceeded` | Price deviates beyond threshold | Price deviation exceeds configured basis point threshold |
| 6042 | `InvalidOracleConfig` | Invalid oracle configuration | Oracle config parameters are invalid |

## sss-transfer-hook Errors

### Hook Errors (7000-7009)

| Code | Name | Message | Cause |
|---|---|---|---|
| 7000 | `SourceBlacklisted` | Source address is blacklisted | Transfer source owner has a blacklist entry |
| 7001 | `DestinationBlacklisted` | Destination address is blacklisted | Transfer destination owner has a blacklist entry |
| 7002 | `InvalidExtraAccountMetas` | Invalid extra account metas | ExtraAccountMetaList validation failed |

## Anchor Framework Errors

These errors come from the Anchor framework and may appear during account validation:

| Code | Name | Cause |
|---|---|---|
| 2000 | `DeclaredProgramIdMismatch` | Program ID does not match `declare_id!` |
| 2001 | `AccountDiscriminatorAlreadySet` | Account already initialized |
| 2003 | `AccountNotEnoughKeys` | Missing required accounts |
| 2006 | `AccountNotInitialized` | Expected initialized account |
| 2012 | `ConstraintHasOne` | `has_one` constraint failed (e.g., wrong mint) |
| 2014 | `ConstraintSeeds` | PDA seeds don't match |
| 2016 | `ConstraintRaw` | Custom constraint check failed |
| 3012 | `AccountNotProgramData` | Account is not a valid program data account |

## Solana Runtime Errors

| Error | Cause |
|---|---|
| `InsufficientFunds` | Not enough SOL for transaction fee or rent |
| `AccountNotFound` | Referenced account does not exist on-chain |
| `ProgramFailedToComplete` | Program exceeded compute budget |
| `InvalidAccountData` | Account data deserialization failed |

## Error Handling in TypeScript

```typescript
import { AnchorError } from "@coral-xyz/anchor";

try {
  await program.methods.mintTokens(new BN(amount))
    .accounts({ /* ... */ })
    .rpc();
} catch (err) {
  if (err instanceof AnchorError) {
    console.log("Error code:", err.error.errorCode.number);
    console.log("Error name:", err.error.errorCode.code);
    console.log("Error message:", err.error.errorMessage);

    switch (err.error.errorCode.number) {
      case 6001:
        // Handle paused
        break;
      case 6010:
        // Handle allowance exceeded
        break;
      case 6020:
        // Handle blacklisted
        break;
    }
  }
}
```

## Error Handling in Rust (CPI)

```rust
use sss_token::error::SssError;

match result {
    Err(e) => {
        if e == SssError::Paused.into() {
            // Handle paused
        }
    }
    Ok(_) => { /* success */ }
}
```
