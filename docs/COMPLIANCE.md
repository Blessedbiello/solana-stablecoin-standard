# Compliance Features

## Overview

The Solana Stablecoin Standard provides a comprehensive compliance toolkit for regulated stablecoin issuers. SSS-2 and SSS-3 presets include blacklisting, token seizure, account freezing, and full audit trail capabilities.

## Compliance Architecture

```
    Compliance Officer
         |
         +-- Blacklister Role
         |     |
         |     +-- add_to_blacklist (blocks transfers)
         |     +-- remove_from_blacklist (restores transfers)
         |
         +-- FreezeAuth Role
         |     |
         |     +-- freeze_account (blocks all account activity)
         |     +-- thaw_account (restores account activity)
         |
         +-- Seizer Role
               |
               +-- seize (transfers tokens to treasury)

    Transfer Hook (automatic)
         |
         +-- Checks source and destination against blacklist
         +-- Rejects transfers involving blacklisted addresses
```

## Blacklisting

### Purpose

Blacklisting prevents an address from sending or receiving tokens through normal transfers. It is used for:
- OFAC sanctions compliance
- Court-ordered asset freezes
- Fraud prevention
- AML/KYC enforcement

### How It Works

1. A Blacklister calls `add_to_blacklist` with the target address and a reason hash
2. A `BlacklistEntry` PDA is created at `["blacklist", config, address]`
3. The transfer hook checks for this PDA during every `transfer_checked` call
4. If the PDA exists (has data), the transfer is rejected

### Blacklist Entry

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The stablecoin this entry belongs to |
| `address` | Pubkey | The blacklisted wallet address |
| `blacklisted_by` | Pubkey | The Blacklister who created this entry |
| `reason_hash` | [u8; 32] | SHA-256 hash of the reason string |
| `created_at` | i64 | Unix timestamp of blacklisting |
| `bump` | u8 | PDA bump seed |

### Reason Hash

The `reason_hash` field stores a 32-byte SHA-256 hash of the blacklist reason. This approach:
- Provides a verifiable link to off-chain documentation
- Keeps sensitive compliance details off-chain
- Creates an immutable on-chain record of the action
- Enables auditors to verify reasons by hashing the off-chain document

```typescript
import { createHash } from "crypto";

const reason = "OFAC SDN List - Entity XYZ - Added 2024-01-15";
const reasonHash = createHash("sha256").update(reason).digest();
// reasonHash is a 32-byte Buffer

await stablecoin.addToBlacklist(targetAddress, reasonHash);
```

### Blacklist Removal

Removing an address from the blacklist:
1. Closes the `BlacklistEntry` PDA
2. Returns rent-exempt lamports to the Blacklister
3. The transfer hook will no longer find the PDA, allowing transfers to proceed

### Blacklist vs. Freeze

| Feature | Blacklist | Freeze |
|---|---|---|
| Scope | Address (all accounts) | Single token account |
| Enforcement | Transfer hook (transfer_checked) | Token-2022 native |
| Blocks transfers | Yes | Yes |
| Blocks minting to address | No (minting bypasses hook) | Yes (frozen account) |
| Preset requirement | SSS-2+ | All presets |
| Role required | Blacklister | FreezeAuth |
| On-chain record | BlacklistEntry PDA with metadata | Account state flag |

For maximum enforcement, use both: blacklist the address AND freeze the token account.

## Token Seizure

### Purpose

Token seizure allows the issuer to reclaim tokens from a non-cooperative holder. Use cases:
- Court-ordered asset forfeiture
- Fraudulent token recovery
- Regulatory compliance actions

### Seize Flow

The seize instruction performs an atomic three-step operation:

```
Step 1: Thaw the frozen account
  - Config PDA signs as freeze authority
  - Required because frozen accounts cannot transfer

Step 2: Transfer tokens to treasury
  - Config PDA signs as permanent delegate
  - Uses transfer_checked (triggers transfer hook)
  - remaining_accounts provide hook resolution data

Step 3: Re-freeze the account
  - Config PDA signs as freeze authority
  - Account remains frozen after seizure
```

### Seize Requirements

- Caller has the Seizer role (role=4)
- Config preset is SSS-2 or SSS-3 (has permanent delegate)
- Amount is greater than zero

### Seize with Transfer Hook

When seizing tokens from an SSS-2 mint, the transfer in step 2 triggers the transfer hook. The instruction must include `remaining_accounts` with the accounts needed by the hook:

```
remaining_accounts:
  [0] extra_account_metas PDA
  [1] hook_config
  [2] stablecoin_config
  [3] sss_token_program
  [4] source_blacklist PDA
  [5] destination_blacklist PDA (treasury)
```

If the source address is blacklisted, the seize will still work because the transfer hook allows seizure transfers. If the treasury is blacklisted, seizure will fail -- ensure the treasury is never blacklisted.

## Account Freezing

### Freeze

Freezing a token account prevents all token operations on that account:
- No transfers in or out
- No burns
- Account is marked as frozen in Token-2022

```typescript
await stablecoin.freezeAccount(targetTokenAccount);
```

### Thaw

Thawing restores normal account operations:

```typescript
await stablecoin.thawAccount(targetTokenAccount);
```

### Freeze + Seize Workflow

The recommended compliance workflow for reclaiming tokens:

1. **Blacklist** the address (prevents any transfers while investigation proceeds)
2. **Freeze** the specific token account (additional protection)
3. **Investigate** and document the reason
4. **Seize** the tokens to treasury (atomic thaw-transfer-refreeze)
5. Token account remains frozen after seizure
6. Optionally **burn** the seized tokens from treasury

## Pause Mechanism

### Global Pause

The Pauser role can pause the entire stablecoin, blocking:
- `mint_tokens`
- `burn_tokens`
- `freeze_account`

Operations that remain available while paused:
- `unpause`
- Role management (`assign_role`, `revoke_role`)
- `update_minter`
- Blacklist management
- `seize` (critical for compliance even during pause)
- `thaw_account`
- Authority transfer
- View instructions

### When to Pause

- Discovered vulnerability in minting logic
- Coordinated compliance action requiring investigation
- Market emergency requiring temporary halt
- System maintenance

## Audit Trail

### On-Chain Events

Every compliance action emits a program event:

| Event | Fields | Triggered By |
|---|---|---|
| `AddressBlacklisted` | config, address, blacklisted_by, reason_hash | `add_to_blacklist` |
| `AddressUnblacklisted` | config, address, removed_by | `remove_from_blacklist` |
| `AccountFrozen` | config, account, authority | `freeze_account` |
| `AccountThawed` | config, account, authority | `thaw_account` |
| `TokensSeized` | config, from, to_treasury, amount, seized_by | `seize` |
| `StablecoinPaused` | config, authority | `pause` |
| `StablecoinUnpaused` | config, authority | `unpause` |
| `RoleAssigned` | config, holder, role, assigned_by | `assign_role` |
| `RoleRevoked` | config, holder, role, revoked_by | `revoke_role` |

### Building an Audit Log

Events can be retrieved from Solana transaction logs:

```typescript
// Fetch historical events
const signatures = await connection.getSignaturesForAddress(configPda);

for (const sig of signatures) {
  const tx = await connection.getTransaction(sig.signature, {
    commitment: "confirmed",
  });

  // Parse Anchor events from transaction logs
  const events = parseEvents(tx.meta.logMessages, program.idl);

  for (const event of events) {
    // Store in audit database
    await auditDb.insert({
      eventType: event.name,
      data: event.data,
      signature: sig.signature,
      blockTime: sig.blockTime,
      slot: sig.slot,
    });
  }
}
```

### Off-Chain Documentation

For each compliance action, maintain off-chain records:

| Record | Contents |
|---|---|
| Blacklist reason | Full text of reason, supporting evidence, authorization |
| Seizure order | Legal authority, court order number, amount, parties |
| Freeze order | Justification, duration, review date |
| Role change | Authorization, business justification, approver |

Link off-chain records to on-chain events using:
- Transaction signature
- `reason_hash` (for blacklist entries)
- Timestamp correlation

## Compliance Reporting

### Required Data Points

| Report | Data Source | Frequency |
|---|---|---|
| Active blacklist | BlacklistEntry PDAs | Daily |
| Seizure log | TokensSeized events | Per occurrence |
| Frozen accounts | Token-2022 account state | Daily |
| Supply audit | config.total_minted - config.total_burned | Daily |
| Role registry | RoleAssignment PDAs | Weekly |
| Minter activity | MinterInfo accounts + TokensMinted events | Daily |

### Supply Reconciliation

```
On-chain supply = config.total_minted - config.total_burned
Token supply    = Mint account supply field
Reserve balance = Off-chain bank/custody balance

Assert: On-chain supply == Token supply == Reserve balance
```
