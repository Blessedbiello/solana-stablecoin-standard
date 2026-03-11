# SSS-2: Compliant Stablecoin Specification

## Overview

SSS-2 is the compliance-oriented preset that adds blacklisting, token seizure, and transfer hook enforcement to the SSS-1 base. It is designed for regulated stablecoins that must comply with sanctions screening, law enforcement requests, and KYC/AML requirements.

## Preset Value

```
Preset::Compliant = 2
```

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|---|---|---|
| MetadataPointer | Yes | On-chain token metadata |
| PermanentDelegate | Yes | Enables token seizure by config PDA |
| TransferHook | Yes | Blacklist enforcement on every transfer |

## Additional Instructions (beyond SSS-1)

| Instruction | Signer | Description |
|---|---|---|
| `add_to_blacklist` | Blacklister | Add an address to the blacklist |
| `remove_from_blacklist` | Blacklister | Remove an address from the blacklist |
| `seize` | Seizer | Seize tokens from a frozen account to treasury |

## Additional Roles (beyond SSS-1)

| Role | ID | Purpose |
|---|---|---|
| Blacklister | 2 | Manages blacklist entries |
| Seizer | 4 | Seizes tokens from frozen accounts |

## Transfer Hook Architecture

### Overview

When a transfer hook is configured on a Token-2022 mint, the runtime automatically invokes the hook program during every `transfer_checked` call. The sss-transfer-hook program uses this to enforce blacklist checks.

### Extra Account Metas

The transfer hook uses `ExtraAccountMetaList` to tell Token-2022 which additional accounts to resolve and pass during transfers:

| Index | Account | Resolution Method |
|---|---|---|
| 0-4 | Standard transfer accounts | Provided by Token-2022 |
| 5 (extra[0]) | HookConfig | Static pubkey |
| 6 (extra[1]) | StablecoinConfig | Static pubkey |
| 7 (extra[2]) | sss-token program ID | Static pubkey |
| 8 (extra[3]) | Source BlacklistEntry PDA | External PDA derived from source owner |
| 9 (extra[4]) | Dest BlacklistEntry PDA | External PDA derived from dest owner |

### Blacklist PDA Resolution

The source and destination blacklist PDAs are derived dynamically by Token-2022:

```
Source blacklist PDA seeds:
  Program: sss-token (index 7)
  Seeds:
    - Literal: "blacklist"
    - AccountKey: stablecoin_config (index 6)
    - AccountData: source token account (index 0), bytes 32..64 (owner field)

Destination blacklist PDA seeds:
  Program: sss-token (index 7)
  Seeds:
    - Literal: "blacklist"
    - AccountKey: stablecoin_config (index 6)
    - AccountData: destination token account (index 2), bytes 32..64 (owner field)
```

### Transfer Rejection Logic

The hook checks whether each blacklist PDA has data:
- If `source_blacklist.data_len() > 0` -- source is blacklisted, transfer rejected
- If `dest_blacklist.data_len() > 0` -- destination is blacklisted, transfer rejected
- If neither exists (data_len == 0) -- transfer proceeds

This works because blacklist PDAs are created when an address is blacklisted and closed (deleted) when removed.

### Fallback Handler

Token-2022 uses the `spl-transfer-hook-interface` instruction format (not Anchor's discriminator format). The fallback handler in `sss-transfer-hook` catches these calls and performs the same blacklist check by inspecting accounts at indices 8 and 9.

## Blacklisting

### Adding to Blacklist

Requirements:
- Caller has the Blacklister role
- Config preset is SSS-2 or SSS-3
- Address is not already blacklisted (PDA must not exist)

Process:
1. Creates a `BlacklistEntry` PDA at `["blacklist", config, address]`
2. Records: config, address, blacklisted_by, reason_hash, created_at, bump
3. Emits `AddressBlacklisted` event

The `reason_hash` is a 32-byte SHA-256 hash of the blacklist reason. The actual reason string is stored off-chain. This provides an audit trail without putting sensitive compliance data on-chain.

### Removing from Blacklist

Requirements:
- Caller has the Blacklister role
- Address is currently blacklisted (PDA must exist)

Process:
1. Closes the `BlacklistEntry` PDA (returns rent to blacklister)
2. Emits `AddressUnblacklisted` event

Once removed, the address can transfer tokens again (assuming the token account is not frozen).

### Effect on Transfers

When a blacklist entry exists for an address:
- All `transfer_checked` calls involving that address as source or destination will fail
- The transfer hook returns `SourceBlacklisted` (error 7000) or `DestinationBlacklisted` (error 7001)
- The address can still receive minted tokens (minting does not go through transfer_checked)
- The address's tokens can still be seized by the Seizer

## Token Seizure

### Seize Flow

The seize instruction uses the PermanentDelegate extension to transfer tokens without the owner's signature. The three-step atomic flow:

```
1. Thaw the frozen account (config PDA signs as freeze authority)
         |
         v
2. Transfer tokens to treasury (config PDA signs as permanent delegate)
   - Includes remaining_accounts for transfer hook resolution
         |
         v
3. Re-freeze the account (config PDA signs as freeze authority)
```

Requirements:
- Caller has the Seizer role
- Config preset has permanent delegate (SSS-2+)
- Amount > 0

### Remaining Accounts for Seize

When seizing tokens from an SSS-2 mint, the transfer in step 2 triggers the transfer hook. The caller must provide the additional accounts needed by the hook as `remaining_accounts`:

1. Extra account metas PDA
2. Hook config
3. Stablecoin config
4. sss-token program
5. Source blacklist PDA
6. Destination (treasury) blacklist PDA

## Initialization

SSS-2 initialization differs from SSS-1 in:

1. **Additional extensions** -- PermanentDelegate and TransferHook are added to the mint
2. **Permanent delegate** -- Config PDA is set as permanent delegate via `initialize_permanent_delegate`
3. **Transfer hook** -- The hook program is registered on the mint via `transfer_hook::instruction::initialize`
4. **Hook program required** -- `transfer_hook_program` account must be provided

After the stablecoin is initialized, the transfer hook must be initialized separately:

```bash
sss-token hook initialize \
  --config <CONFIG_PUBKEY> \
  --mint <MINT_PUBKEY> \
  --keypair <AUTHORITY_KEYPAIR>
```

This creates the `ExtraAccountMetaList` account that Token-2022 reads during transfers.

## Example: Deploy an SSS-2 Stablecoin

```typescript
const stablecoin = new SolanaStablecoin({
  connection,
  wallet: authority,
  preset: "SSS-2",
});

// Initialize stablecoin
const { config, mint } = await stablecoin.initialize({
  configId: 0,
  decimals: 6,
  name: "Compliant USD",
  symbol: "CUSD",
  uri: "https://example.com/metadata.json",
});

// Initialize transfer hook
await stablecoin.initializeHook();

// Assign all roles
await stablecoin.assignRole(minterWallet, Role.Minter);
await stablecoin.assignRole(burnerWallet, Role.Burner);
await stablecoin.assignRole(pauserWallet, Role.Pauser);
await stablecoin.assignRole(freezerWallet, Role.FreezeAuth);
await stablecoin.assignRole(blacklisterWallet, Role.Blacklister);
await stablecoin.assignRole(seizerWallet, Role.Seizer);

// Configure minter
await stablecoin.updateMinter(minterWallet, 10_000_000_000000, true);

// Compliance action: blacklist a sanctioned address
const reasonHash = sha256("OFAC SDN List - 2024-01-15");
await stablecoin.addToBlacklist(sanctionedAddress, reasonHash);

// Seize tokens from frozen account
await stablecoin.freezeAccount(targetTokenAccount);
await stablecoin.seize(targetTokenAccount, seizeAmount);
```

## Compliance Workflow

See [COMPLIANCE.md](COMPLIANCE.md) for detailed compliance procedures including:
- Sanctions screening integration
- Blacklist management best practices
- Seizure procedures and documentation
- Audit trail requirements
