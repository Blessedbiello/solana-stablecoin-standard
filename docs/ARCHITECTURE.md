# Architecture

## System Overview

The Solana Stablecoin Standard is a multi-layered system built on Solana's Token-2022 program. It consists of two on-chain programs, four shared Rust modules, a TypeScript SDK, a CLI, and backend services.

```
    +----------------------------------------------------------+
    |                     Client Layer                          |
    |  +------------+  +-------------+  +-------------------+  |
    |  | CLI Tool   |  | TypeScript  |  | Web Dashboard     |  |
    |  | (sss-token)|  | SDK         |  | (future)          |  |
    |  +------+-----+  +------+------+  +---------+---------+  |
    +---------|--------------|--------------------|------------+
              |              |                    |
    +---------v--------------v--------------------v------------+
    |                    Backend Layer                          |
    |  +--------------------------------------------------+    |
    |  | REST API  |  Event Listener  |  Monitoring        |    |
    |  +--------------------------------------------------+    |
    +-----------------------------|----------------------------+
                                  |
    +-----------------------------v----------------------------+
    |                  Solana RPC / WebSocket                   |
    +-----------------------------+----------------------------+
                                  |
    +-----------------------------v----------------------------+
    |                   On-Chain Layer                          |
    |  +---------------------------------------------------+   |
    |  |  sss-token Program (VuhEhak...)                   |   |
    |  |  15 instructions | RBAC | Mint/Burn/Freeze/Seize  |   |
    |  +---------------------------+-----------------------+   |
    |                              |                           |
    |                         CPI  |  Transfer Hook            |
    |                              |                           |
    |  +---------------------------v-----------------------+   |
    |  |  sss-transfer-hook Program (5ADnkQ...)            |   |
    |  |  Blacklist enforcement on transfer_checked        |   |
    |  +---------------------------------------------------+   |
    |                                                          |
    |  +---------------------------------------------------+   |
    |  |  Token-2022 (SPL)                                 |   |
    |  |  MetadataPointer | PermanentDelegate | TransferHook|  |
    |  +---------------------------------------------------+   |
    +----------------------------------------------------------+
```

## On-Chain Programs

### sss-token

The core program manages stablecoin lifecycle operations. It owns the config PDA, which serves as the mint authority, freeze authority, and permanent delegate for the Token-2022 mint.

**Program ID:** `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB`

**Responsibilities:**
- Initialize stablecoin with Token-2022 extensions
- Mint and burn tokens with allowance tracking
- Freeze and thaw token accounts
- Pause and unpause all operations
- Manage RBAC roles
- Blacklist management (SSS-2+)
- Token seizure via permanent delegate (SSS-2+)
- Two-step authority transfer

### sss-transfer-hook

The transfer hook program enforces blacklist checks during every `transfer_checked` call. Token-2022 automatically invokes this program when a transfer hook is configured on the mint.

**Program ID:** `5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV`

**Responsibilities:**
- Initialize extra account metas for blacklist PDA resolution
- Check source and destination against blacklist during transfers
- Provide fallback handler for spl-transfer-hook-interface compatibility

## Account Model

### PDA Derivation Map

```
    Authority + ConfigID
          |
          v
    +---------------------+
    |  StablecoinConfig    |  seeds: ["stablecoin_config", authority, config_id(u64 LE)]
    |  (master PDA)        |
    +-----+-------+-------+
          |       |
          v       v
    +----------+ +------------------+
    | Mint PDA | | MinterInfo PDA   |  seeds: ["minter_info", config, minter]
    | (Token-  | | (per minter)     |
    |  2022)   | +------------------+
    | seeds:   |
    | ["sss_   | +------------------+
    |  mint",  | | RoleAssignment   |  seeds: ["role", config, holder, role_u8]
    |  config] | | PDA (per holder  |
    +----------+ |  per role)       |
                 +------------------+
                 +------------------+
                 | BlacklistEntry   |  seeds: ["blacklist", config, address]
                 | PDA (SSS-2+)    |
                 +------------------+
                 +------------------+
                 | AllowlistEntry   |  seeds: ["allowlist", config, address]
                 | PDA (SSS-3)     |
                 +------------------+
```

### Account Sizes

| Account | Fields | Approximate Size |
|---|---|---|
| StablecoinConfig | authority, pending, mint, treasury, hook, totals, flags, reserved | ~330 bytes |
| MinterInfo | config, minter, allowance, total_minted, active, bump | ~82 bytes |
| RoleAssignment | config, holder, role, assigned_by, assigned_at, bump | ~106 bytes |
| BlacklistEntry | config, address, blacklisted_by, reason_hash, created_at, bump | ~138 bytes |
| AllowlistEntry | config, address, bump | ~66 bytes |
| TransferHookConfig | stablecoin_config, mint, bump | ~66 bytes |

## Data Flow

### Mint Flow

```
    Minter (signer)
         |
         v
    [mint_tokens instruction]
         |
         +-- 1. Validate: amount > 0, not paused, minter active
         +-- 2. Check: remaining allowance >= amount
         +-- 3. CPI: spl_token_2022::mint_to (config PDA signs as mint authority)
         +-- 4. Update: minter_info.total_minted += amount
         +-- 5. Update: config.total_minted += amount
         +-- 6. Emit: TokensMinted event
```

### Transfer Flow (SSS-2)

```
    User calls transfer_checked on Token-2022
         |
         v
    [Token-2022 processes transfer]
         |
         +-- Detects TransferHook extension on mint
         +-- Resolves ExtraAccountMetas:
         |     - hook_config (static)
         |     - stablecoin_config (static)
         |     - sss_token_program (static)
         |     - source_blacklist PDA (derived from source owner)
         |     - dest_blacklist PDA (derived from dest owner)
         |
         v
    [CPI to sss-transfer-hook::execute]
         |
         +-- Check source_blacklist PDA: data_len > 0 -> REJECT
         +-- Check dest_blacklist PDA: data_len > 0 -> REJECT
         +-- Both clean -> transfer proceeds
```

### Seize Flow (SSS-2+)

```
    Seizer (signer with Seizer role)
         |
         v
    [seize instruction]
         |
         +-- 1. Validate: Seizer role exists, preset has permanent delegate
         +-- 2. CPI: thaw_account (config PDA signs as freeze authority)
         +-- 3. CPI: transfer_checked (config PDA signs as permanent delegate)
         |          includes remaining_accounts for transfer hook
         +-- 4. CPI: freeze_account (re-freeze the source)
         +-- 5. Emit: TokensSeized event
```

### Authority Transfer Flow

```
    Current Authority                New Authority
         |                                |
         v                                |
    [initiate_authority_transfer]          |
         |                                |
         +-- Sets pending_authority       |
         +-- Emits AuthorityTransferInitiated
                                          |
                                          v
                                   [accept_authority]
                                          |
                                          +-- Validates pending matches signer
                                          +-- Sets master_authority = new
                                          +-- Clears pending_authority
                                          +-- Emits AuthorityTransferred
```

## Shared Modules

### sss-math

Pure Rust library (`no_std`) providing arithmetic utilities:
- `apply_bps(amount, bps)` -- Basis point calculations
- `check_quota(used, amount, allowance)` -- Allowance checks
- `abs_diff(a, b)` -- Absolute difference
- `exceeds_deviation(actual, target, threshold_bps)` -- Price deviation checks

### sss-roles

Role definitions and PDA seed helpers:
- `Role` enum: Minter(0), Burner(1), Blacklister(2), Pauser(3), Seizer(4), FreezeAuth(5)
- `requires_sss2()` -- Returns true for Blacklister and Seizer
- `role_seeds()` -- PDA seed construction helper

### sss-compliance

Preset definitions and compliance PDA helpers:
- `Preset` enum: Minimal(1), Compliant(2), Private(3)
- Feature flags: `has_transfer_hook()`, `has_permanent_delegate()`, `has_confidential_transfers()`
- `find_blacklist_entry()` -- Blacklist PDA derivation
- `find_allowlist_entry()` -- Allowlist PDA derivation

### sss-oracle

Oracle feed integration utilities:
- `find_oracle_config()` -- Oracle config PDA derivation
- `is_feed_fresh()` -- Staleness validation

## Token-2022 Extensions

### MetadataPointer (All Presets)

Points the mint account to itself for on-chain metadata storage. The config PDA is the update authority. Metadata fields (name, symbol, URI) are set during initialization.

### PermanentDelegate (SSS-2+)

The config PDA is set as the permanent delegate on the mint. This allows the seize instruction to transfer tokens from any account without the owner's signature, which is required for regulatory compliance actions.

### TransferHook (SSS-2+)

Configures the sss-transfer-hook program to be invoked on every `transfer_checked` call. The hook resolves blacklist PDAs using ExtraAccountMetas and rejects transfers involving blacklisted addresses.

## RBAC Model

```
    Master Authority
         |
         |-- assign_role / revoke_role
         |-- update_minter (allowance, active)
         |-- initiate_authority_transfer
         |
         +---> Minter (role=0)      -- mint_tokens
         +---> Burner (role=1)      -- burn_tokens
         +---> Blacklister (role=2) -- add/remove_from_blacklist (SSS-2+)
         +---> Pauser (role=3)      -- pause / unpause
         +---> Seizer (role=4)      -- seize (SSS-2+)
         +---> FreezeAuth (role=5)  -- freeze_account / thaw_account
```

Roles are represented as PDA accounts. A role exists if and only if its PDA account exists on-chain. Revoking a role closes the PDA account and returns rent to the authority.

## Dependency Graph

```
    sss-token
      +-- anchor-lang 0.32.1
      +-- anchor-spl 0.32.1
      +-- spl-token-2022 8.0.1
      +-- spl-transfer-hook-interface 0.8.2
      +-- spl-token-metadata-interface 0.5.1
      +-- spl-pod 0.4.0
      +-- sss-math (local)
      +-- sss-roles (local)
      +-- sss-compliance (local)

    sss-transfer-hook
      +-- anchor-lang 0.32.1
      +-- anchor-spl 0.32.1
      +-- spl-token-2022 8.0.1
      +-- spl-transfer-hook-interface 0.8.2
      +-- spl-tlv-account-resolution 0.8.1
      +-- sss-compliance (local)
```
