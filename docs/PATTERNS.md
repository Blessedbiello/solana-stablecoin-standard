# Design Patterns -- Solana Stablecoin Standard

This document describes the core design patterns used across the `sss-token` and
`sss-transfer-hook` programs. It serves as a reference for contributors,
auditors, and integrators.

Program IDs:

- **sss-token**: `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB`
- **sss-transfer-hook**: `5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV`

---

## 1. PDA Derivation Patterns

Every on-chain account in the system is a Program Derived Address. The table
below lists every PDA, its seeds, and the owning program.

| Account | Seeds | Program |
|---------|-------|---------|
| StablecoinConfig | `["stablecoin_config", authority, config_id(u64 LE)]` | sss-token |
| Mint | `["sss_mint", config]` | sss-token |
| MinterInfo | `["minter_info", config, minter]` | sss-token |
| RoleAssignment | `["role", config, holder, role_u8]` | sss-token |
| BlacklistEntry | `["blacklist", config, address]` | sss-token |
| AllowlistEntry | `["allowlist", config, address]` | sss-token |
| HookConfig | `["hook_config", mint]` | sss-transfer-hook |
| ExtraAccountMetas | `["extra-account-metas", mint]` | sss-transfer-hook |
| OracleConfig | `["oracle_config", config]` | sss-token |

### 1.1 Rust (Anchor seeds attribute)

**StablecoinConfig** -- derived from the deploying authority and a u64 config
identifier. The config_id allows a single authority to deploy multiple
independent stablecoins.

```rust
#[account(
    init,
    payer = authority,
    space = 8 + StablecoinConfig::INIT_SPACE,
    seeds = [b"stablecoin_config", authority.key().as_ref(), &params.config_id.to_le_bytes()],
    bump,
)]
pub config: Account<'info, StablecoinConfig>,
```

**Mint** -- derived from the config PDA. One mint per config.

```rust
#[account(
    mut,
    seeds = [b"sss_mint", config.key().as_ref()],
    bump,
)]
pub mint: UncheckedAccount<'info>,
```

**MinterInfo** -- derived from the config PDA and the minter wallet.

```rust
#[account(
    mut,
    seeds = [b"minter_info", config.key().as_ref(), minter.key().as_ref()],
    bump = minter_info.bump,
)]
pub minter_info: Account<'info, MinterInfo>,
```

**RoleAssignment** -- derived from the config, the holder wallet, and the role
byte. The role byte selects which role (0=Minter, 1=Burner, 2=Blacklister,
3=Pauser, 4=Seizer, 5=FreezeAuth).

```rust
#[account(
    init,
    payer = authority,
    space = 8 + RoleAssignment::INIT_SPACE,
    seeds = [b"role", config.key().as_ref(), holder.key().as_ref(), &[role]],
    bump,
)]
pub role_assignment: Account<'info, RoleAssignment>,
```

**BlacklistEntry** -- derived from the config and the address being blacklisted.
Uses the `BLACKLIST_SEED` constant from `sss-compliance`.

```rust
#[account(
    init,
    payer = blacklister,
    space = 8 + BlacklistEntry::INIT_SPACE,
    seeds = [b"blacklist", config.key().as_ref(), address.key().as_ref()],
    bump,
)]
pub blacklist_entry: Account<'info, BlacklistEntry>,
```

**AllowlistEntry** -- same derivation pattern as BlacklistEntry, used in SSS-3.

```rust
seeds = [b"allowlist", config.key().as_ref(), address.key().as_ref()]
```

**HookConfig and ExtraAccountMetas** -- both derived from the mint key in the
transfer hook program.

```rust
#[account(
    init,
    payer = authority,
    space = 8 + TransferHookConfig::INIT_SPACE,
    seeds = [b"hook_config", mint.key().as_ref()],
    bump,
)]
pub hook_config: Account<'info, TransferHookConfig>,

#[account(
    mut,
    seeds = [b"extra-account-metas", mint.key().as_ref()],
    bump,
)]
pub extra_account_metas: UncheckedAccount<'info>,
```

### 1.2 TypeScript (PublicKey.findProgramAddressSync)

```typescript
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const SSS_TOKEN_PROGRAM_ID = new PublicKey("VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB");
const SSS_HOOK_PROGRAM_ID  = new PublicKey("5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV");

// StablecoinConfig
const configId = new BN(0);
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("stablecoin_config"), authority.toBuffer(), configId.toArrayLike(Buffer, "le", 8)],
  SSS_TOKEN_PROGRAM_ID,
);

// Mint
const [mintPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("sss_mint"), configPda.toBuffer()],
  SSS_TOKEN_PROGRAM_ID,
);

// MinterInfo
const [minterInfoPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("minter_info"), configPda.toBuffer(), minterWallet.toBuffer()],
  SSS_TOKEN_PROGRAM_ID,
);

// RoleAssignment (e.g., Pauser = 3)
const [rolePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("role"), configPda.toBuffer(), holder.toBuffer(), Buffer.from([3])],
  SSS_TOKEN_PROGRAM_ID,
);

// BlacklistEntry
const [blacklistPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("blacklist"), configPda.toBuffer(), targetAddress.toBuffer()],
  SSS_TOKEN_PROGRAM_ID,
);

// AllowlistEntry
const [allowlistPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("allowlist"), configPda.toBuffer(), targetAddress.toBuffer()],
  SSS_TOKEN_PROGRAM_ID,
);

// HookConfig
const [hookConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("hook_config"), mintPda.toBuffer()],
  SSS_HOOK_PROGRAM_ID,
);

// ExtraAccountMetas
const [extraMetasPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mintPda.toBuffer()],
  SSS_HOOK_PROGRAM_ID,
);

// OracleConfig
const [oracleConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_config"), configPda.toBuffer()],
  SSS_TOKEN_PROGRAM_ID,
);
```

---

## 2. CPI Patterns

The `sss-token` program never holds tokens itself. All token operations are
performed through CPI to Token-2022, with the config PDA signing as the mint
authority, freeze authority, or permanent delegate.

### 2.1 Config PDA as signer

Every CPI uses the same signer-seed construction. The config PDA stores its own
`bump`, `master_authority`, and `config_id`, so any instruction handler can
reconstruct the seeds:

```rust
let authority_key = config.master_authority;
let config_id_bytes = config.config_id.to_le_bytes();
let config_seeds: &[&[u8]] = &[
    b"stablecoin_config",
    authority_key.as_ref(),
    &config_id_bytes,
    &[config.bump],
];
```

### 2.2 Mint CPI

The config PDA is the mint authority. `mint_to` is invoked via `invoke_signed`
with the config seeds:

```rust
invoke_signed(
    &spl_token_2022::instruction::mint_to(
        &spl_token_2022::ID,
        &mint_key,
        &recipient_token_account_key,
        &config_key,   // mint authority = config PDA
        &[],
        amount,
    )?,
    &[mint_info, recipient_info, config_info],
    &[config_seeds],
)?;
```

### 2.3 Freeze / Thaw CPI

The config PDA is the freeze authority (set during `initialize_mint2` with
`Some(&config_key)` as the freeze authority parameter):

```rust
invoke_signed(
    &spl_token_2022::instruction::freeze_account(
        &spl_token_2022::ID,
        &token_account_key,
        &mint_key,
        &config_key,   // freeze authority = config PDA
        &[],
    )?,
    &[token_account_info, mint_info, config_info],
    &[config_seeds],
)?;
```

Thaw uses the identical pattern with `thaw_account`.

### 2.4 Transfer (Seize) CPI

For SSS-2+ mints, the config PDA is the permanent delegate. Seize uses a
three-step flow: thaw -> transfer_checked -> re-freeze.

The transfer CPI must include `remaining_accounts` so that Token-2022 can
invoke the transfer hook. The instruction's account list is extended at
runtime:

```rust
let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
    &spl_token_2022::ID,
    &source_key,
    &mint_key,
    &treasury_key,
    &config_key,   // permanent delegate = config PDA
    &[],
    amount,
    config.decimals,
)?;

let mut account_infos = vec![source_info, mint_info, treasury_info, config_info];

// Append transfer-hook extra accounts
for remaining in ctx.remaining_accounts {
    transfer_ix.accounts.push(AccountMeta {
        pubkey: remaining.key(),
        is_signer: remaining.is_signer,
        is_writable: remaining.is_writable,
    });
    account_infos.push(remaining.to_account_info());
}

invoke_signed(&transfer_ix, &account_infos, &[config_seeds])?;
```

### 2.5 Token-2022 to sss-transfer-hook CPI

This CPI is automatic. When a mint has the TransferHook extension configured,
Token-2022 invokes the hook program during every `transfer_checked`. The hook
program receives the call through the `spl-transfer-hook-interface` format
(not an Anchor discriminator), which is handled by the fallback entry point
and the `#[interface(spl_transfer_hook_interface::execute)]` attribute.

---

## 3. Seven-Step Instruction Pattern

Every instruction handler in `sss-token` follows a consistent structure:

```
1. Validate inputs     -- check parameters, require!() guards
2. Read state          -- load config, minter_info, role assignments
3. Calculate           -- compute allowances, amounts, checked math
4. Check constraints   -- verify preset feature gates, paused state, RBAC
5. Execute CPI         -- invoke_signed to Token-2022
6. Update state        -- mutate on-chain accounts
7. Emit event          -- emit!() for indexers and audit trails
```

**Example -- mint handler (abbreviated):**

```rust
pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    // 1. Validate
    require!(amount > 0, SssError::InvalidMintAmount);

    // 2. Read state (via Anchor deserialization)
    let minter_info = &ctx.accounts.minter_info;

    // 3. Calculate
    let remaining_allowance = minter_info.allowance
        .checked_sub(minter_info.total_minted)
        .ok_or(SssError::Overflow)?;

    // 4. Check constraints
    require!(amount <= remaining_allowance, SssError::AllowanceExceeded);

    // 5. Execute CPI
    invoke_signed(
        &spl_token_2022::instruction::mint_to(/* ... */),
        &[/* ... */],
        &[config_seeds],
    )?;

    // 6. Update state
    let minter_info = &mut ctx.accounts.minter_info;
    minter_info.total_minted = minter_info.total_minted
        .checked_add(amount).ok_or(SssError::Overflow)?;

    // 7. Emit event
    emit!(TokensMinted { /* ... */ });

    Ok(())
}
```

Steps 2-4 often overlap with Anchor's account constraints (e.g., `has_one`,
`constraint = !config.paused`). The pattern is a logical guide, not a rigid
requirement for every handler to have exactly seven distinct blocks.

---

## 4. Two-Step Authority Transfer Pattern

Authority over a stablecoin config cannot be transferred in a single
transaction. This prevents accidental transfers to invalid or uncontrolled
addresses.

### Step 1: Initiate

The current `master_authority` calls `initiate_authority_transfer`, which sets
`pending_authority` on the config to the proposed new authority:

```rust
// Constraint: only current master_authority can initiate
constraint = config.master_authority == authority.key()

// Handler:
config.pending_authority = new_authority.key();
```

### Step 2: Accept

The `pending_authority` calls `accept_authority`. The handler validates that the
signer matches the pending value, then atomically updates the authority and
clears the pending field:

```rust
// Constraints:
constraint = config.pending_authority == new_authority.key()
constraint = config.pending_authority != Pubkey::default()

// Handler:
config.master_authority = new_authority.key();
config.pending_authority = Pubkey::default();
```

A transfer can be cancelled by the current authority initiating a new transfer
to `Pubkey::default()` or to themselves.

---

## 5. ExtraAccountMeta Resolution

The transfer hook needs access to blacklist PDAs for both the source and
destination token owners. Token-2022 resolves these accounts automatically
using the `ExtraAccountMetaList` stored at the `extra-account-metas` PDA.

### 5.1 Fixed accounts (indices 0-4)

These are always provided by Token-2022 to the hook's `Execute` instruction:

| Index | Account | Description |
|-------|---------|-------------|
| 0 | source | Source token account |
| 1 | mint | Token-2022 mint |
| 2 | destination | Destination token account |
| 3 | source_authority | Owner or delegate of the source |
| 4 | extra_account_metas | The ExtraAccountMetaList validation account |

### 5.2 Extra accounts (indices 5-9)

Defined during `initialize_hook` and resolved by Token-2022 at transfer time:

| Index | Extra Index | Account | Resolution |
|-------|-------------|---------|------------|
| 5 | extra[0] | hook_config | Static pubkey |
| 6 | extra[1] | stablecoin_config | Static pubkey |
| 7 | extra[2] | sss_token_program | Static pubkey |
| 8 | extra[3] | source_blacklist | External PDA (see below) |
| 9 | extra[4] | dest_blacklist | External PDA (see below) |

### 5.3 Blacklist PDA resolution with Seed::AccountData

The blacklist PDAs are derived from the sss-token program (index 7) with seeds
that reference runtime account data. This is where `Seed::AccountData` is
used to extract the token account owner from the SPL token account layout.

In an SPL Token-2022 account, the `owner` field occupies bytes 32..64. The
extra meta definition uses this offset to dynamically derive the blacklist PDA
for the actual wallet owner (not the token account address):

```rust
// Source blacklist PDA
ExtraAccountMeta::new_external_pda_with_seeds(
    7,  // program index: sss_token_program (absolute index in account list)
    &[
        Seed::Literal { bytes: b"blacklist".to_vec() },
        Seed::AccountKey { index: 6 },     // stablecoin_config pubkey
        Seed::AccountData {
            account_index: 0,              // source token account (index 0)
            data_index: 32,                // offset to owner field
            length: 32,                    // pubkey is 32 bytes
        },
    ],
    false,  // is_signer
    false,  // is_writable
)?;

// Destination blacklist PDA -- identical except account_index: 2
ExtraAccountMeta::new_external_pda_with_seeds(
    7,
    &[
        Seed::Literal { bytes: b"blacklist".to_vec() },
        Seed::AccountKey { index: 6 },
        Seed::AccountData {
            account_index: 2,              // destination token account (index 2)
            data_index: 32,
            length: 32,
        },
    ],
    false,
    false,
)?;
```

### 5.4 Blacklist check logic

The hook's execute handler checks whether each blacklist PDA has data. If a
`BlacklistEntry` account exists at that PDA (i.e., `data_len() > 0`), the
address is blacklisted and the transfer is rejected:

```rust
if source_blacklist.data_len() > 0 {
    return Err(HookError::SourceBlacklisted.into());
}
if dest_blacklist.data_len() > 0 {
    return Err(HookError::DestinationBlacklisted.into());
}
```

If the PDA does not exist on-chain, the runtime provides a zero-lamport account
with no data, and `data_len()` returns 0 -- the transfer proceeds.

---

## 6. Role Existence as Authorization

The RBAC system uses a PDA-existence pattern instead of a bitmask or a mapping
account. A role is granted by initializing a `RoleAssignment` PDA; a role is
revoked by closing that PDA.

### Why this pattern

- **No enumeration overhead.** There is no central list to iterate. Each check
  is a single PDA derivation and account existence test.
- **Deterministic addresses.** Anyone can derive the PDA off-chain to check
  whether a role exists without an RPC call, by attempting to fetch the account.
- **Anchor constraint integration.** Anchor's `seeds` constraint will fail
  deserialization if the account does not exist, providing automatic RBAC
  enforcement at the framework level.

### Granting a role

```rust
// AssignRole: init creates the PDA. If it already exists, the tx fails.
#[account(
    init,
    payer = authority,
    space = 8 + RoleAssignment::INIT_SPACE,
    seeds = [b"role", config.key().as_ref(), holder.key().as_ref(), &[role]],
    bump,
)]
pub role_assignment: Account<'info, RoleAssignment>,
```

### Revoking a role

```rust
// RevokeRole: close destroys the PDA and returns rent to authority.
#[account(
    mut,
    close = authority,
    seeds = [b"role", config.key().as_ref(), holder.key().as_ref(), &[role]],
    bump = role_assignment.bump,
)]
pub role_assignment: Account<'info, RoleAssignment>,
```

### Checking a role (in other instructions)

Instructions that require a specific role include the `role_assignment` PDA in
their account list. Anchor validates the seeds and deserializes the account. If
the PDA does not exist, the transaction fails before the handler runs:

```rust
// FreezeAccount requires FreezeAuth role (5)
#[account(
    seeds = [b"role", config.key().as_ref(), freeze_authority.key().as_ref(), &[5u8]],
    bump,
)]
pub role_assignment: UncheckedAccount<'info>,
```

### Role values

| Value | Role | Required Preset |
|-------|------|-----------------|
| 0 | Minter | SSS-1+ |
| 1 | Burner | SSS-1+ |
| 2 | Blacklister | SSS-2+ |
| 3 | Pauser | SSS-1+ |
| 4 | Seizer | SSS-2+ |
| 5 | FreezeAuth | SSS-1+ |

---

## 7. Preset Feature Gating

The `preset` field on `StablecoinConfig` (stored as a `u8`) controls which
Token-2022 extensions are enabled at initialization and which instructions are
available at runtime.

### Preset definitions

| Preset | Value | Extensions | Features |
|--------|-------|------------|----------|
| SSS-1 (Minimal) | 1 | MetadataPointer | mint, burn, freeze, thaw, pause, roles |
| SSS-2 (Compliant) | 2 | MetadataPointer, PermanentDelegate, TransferHook | + blacklist, seize, transfer hook enforcement |
| SSS-3 (Private) | 3 | MetadataPointer, PermanentDelegate, TransferHook | + confidential transfers, allowlists |

### Compile-time gating (initialization)

During `initialize`, the preset determines which extensions are added to the
mint before `initialize_mint2` is called:

```rust
let preset = Preset::from_u8(params.preset).ok_or(SssError::InvalidPreset)?;

let mut extensions = vec![ExtensionType::MetadataPointer];

if preset.has_permanent_delegate() {
    extensions.push(ExtensionType::PermanentDelegate);
}
if preset.has_transfer_hook() {
    extensions.push(ExtensionType::TransferHook);
}
```

### Runtime gating (instruction constraints)

Instructions gated to SSS-2+ use Anchor constraints that check the preset:

```rust
// Seize -- requires permanent delegate (SSS-2+)
#[account(
    has_one = mint,
    constraint = Preset::from_u8(config.preset)
        .map(|p| p.has_permanent_delegate())
        .unwrap_or(false) @ SssError::FeatureNotAvailable,
)]
pub config: Account<'info, StablecoinConfig>,
```

```rust
// Blacklist -- requires transfer hook (SSS-2+)
#[account(
    constraint = Preset::from_u8(config.preset)
        .map(|p| p.has_transfer_hook())
        .unwrap_or(false) @ SssError::FeatureNotAvailable,
)]
pub config: Account<'info, StablecoinConfig>,
```

### Role-level gating

Certain roles can only be assigned when the preset supports them. The
`assign_role` handler checks this:

```rust
if let Some(r) = Role::from_u8(role) {
    if r.requires_sss2() && !preset.has_transfer_hook() {
        return Err(SssError::FeatureNotAvailable.into());
    }
}
```

The roles that require SSS-2 are Blacklister (2) and Seizer (4). Attempting to
assign these roles on an SSS-1 config will fail.
