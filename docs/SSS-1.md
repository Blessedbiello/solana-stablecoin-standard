# SSS-1: Minimal Stablecoin Specification

## Overview

SSS-1 is the minimal stablecoin preset providing core token lifecycle operations without compliance-specific features. It is suitable for internal tokens, testing environments, or jurisdictions without transfer-level compliance requirements.

## Preset Value

```
Preset::Minimal = 1
```

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|---|---|---|
| MetadataPointer | Yes | On-chain token metadata (name, symbol, URI) |
| PermanentDelegate | No | Not needed without seizure capability |
| TransferHook | No | Not needed without blacklist enforcement |

## Available Instructions

| Instruction | Signer | Description |
|---|---|---|
| `initialize` | Authority | Create config PDA and Token-2022 mint |
| `mint_tokens` | Minter | Mint tokens to a recipient |
| `burn_tokens` | Burner | Burn tokens from own account |
| `freeze_account` | FreezeAuth | Freeze a token account |
| `thaw_account` | FreezeAuth | Thaw a frozen account |
| `pause` | Pauser | Pause all operations |
| `unpause` | Pauser | Resume operations |
| `update_minter` | Authority | Set minter allowance and active status |
| `assign_role` | Authority | Assign a role to a wallet |
| `revoke_role` | Authority | Revoke a role |
| `initiate_authority_transfer` | Authority | Begin two-step authority transfer |
| `accept_authority` | Pending Authority | Complete authority transfer |
| `get_config` | Permissionless | View stablecoin configuration |
| `get_minter_info` | Permissionless | View minter details |

## Unavailable Instructions (SSS-2+ only)

The following instructions will fail with `FeatureNotAvailable` (error 6008):

- `add_to_blacklist`
- `remove_from_blacklist`
- `seize`

Attempting to assign the `Blacklister` (role=2) or `Seizer` (role=4) roles will also fail with `FeatureNotAvailable`.

## Available Roles

| Role | ID | Available | Purpose |
|---|---|---|---|
| Minter | 0 | Yes | Can mint tokens |
| Burner | 1 | Yes | Can burn tokens |
| Blacklister | 2 | No | Requires SSS-2+ |
| Pauser | 3 | Yes | Can pause/unpause |
| Seizer | 4 | No | Requires SSS-2+ |
| FreezeAuth | 5 | Yes | Can freeze/thaw accounts |

## Account Structure

### StablecoinConfig

| Field | Value for SSS-1 |
|---|---|
| `preset` | `1` |
| `transfer_hook_program` | `Pubkey::default()` (11111...111) |
| `paused` | `false` (initially) |

### Mint Account

The Token-2022 mint is created with:
- Mint authority: Config PDA
- Freeze authority: Config PDA
- Extensions: MetadataPointer only
- Metadata stored on the mint account itself (self-referencing pointer)

## Initialization Flow

1. Validate parameters (preset=1, decimals 0-18, name/symbol/uri length)
2. Calculate mint account space for MetadataPointer extension only
3. Create mint account via `system_program::create_account` (CPI, mint PDA signs)
4. Initialize MetadataPointer extension (points to self, update authority = config PDA)
5. Initialize mint via `initialize_mint2` (mint authority = config PDA, freeze authority = config PDA)
6. Initialize token metadata (name, symbol, URI, update authority = config PDA)
7. Populate config state
8. Emit `StablecoinInitialized` event

## Minting Flow

1. Validate: amount > 0, stablecoin not paused, minter is active
2. Check minter's remaining allowance (allowance - total_minted >= amount)
3. CPI to Token-2022 `mint_to` (config PDA signs as mint authority)
4. Update minter_info.total_minted
5. Update config.total_minted
6. Emit `TokensMinted` event

## Burning Flow

1. Validate: amount > 0, stablecoin not paused
2. Verify Burner role exists (PDA seed constraint)
3. CPI to Token-2022 `burn` (burner signs as token account owner)
4. Update config.total_burned
5. Emit `TokensBurned` event

## Example: Deploy an SSS-1 Stablecoin

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";

const stablecoin = new SolanaStablecoin({
  connection,
  wallet: authority,
  preset: "SSS-1",
});

// Initialize
const { config, mint } = await stablecoin.initialize({
  configId: 0,
  decimals: 6,
  name: "Simple Token",
  symbol: "SMPL",
  uri: "https://example.com/metadata.json",
});

// Assign roles
await stablecoin.assignRole(minterWallet, Role.Minter);
await stablecoin.assignRole(burnerWallet, Role.Burner);
await stablecoin.assignRole(pauserWallet, Role.Pauser);
await stablecoin.assignRole(freezerWallet, Role.FreezeAuth);

// Configure minter
await stablecoin.updateMinter(minterWallet, 1_000_000_000000, true);

// Mint 1000 tokens
await stablecoin.mint(recipientWallet, 1000_000000);
```

## Upgrading to SSS-2

SSS-1 deployments cannot be upgraded to SSS-2 in-place because Token-2022 extensions must be configured at mint creation time. To migrate:

1. Deploy a new SSS-2 stablecoin
2. Have users redeem SSS-1 tokens (burn)
3. Mint equivalent SSS-2 tokens to users
4. Decommission the SSS-1 deployment
