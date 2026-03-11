# SSS-3: Private Stablecoin Specification

## Overview

SSS-3 extends SSS-2 with privacy features including confidential transfers and allowlists. It is designed for stablecoins that require transaction privacy while maintaining regulatory compliance through allowlist-based access control.

## Preset Value

```
Preset::Private = 3
```

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|---|---|---|
| MetadataPointer | Yes | On-chain token metadata |
| PermanentDelegate | Yes | Enables token seizure by config PDA |
| TransferHook | Yes | Blacklist enforcement on every transfer |
| ConfidentialTransfer | Yes | Encrypted transfer amounts |

## Features Beyond SSS-2

### Confidential Transfers

SSS-3 enables the Token-2022 ConfidentialTransfer extension, which allows token holders to transfer tokens with encrypted amounts. The transfer amount is hidden from public observers while remaining verifiable by the parties involved using zero-knowledge proofs.

Key properties:
- Transfer amounts are encrypted using ElGamal encryption
- The sender and recipient can decrypt the amounts
- The auditor (config PDA) can decrypt all amounts
- The total supply remains publicly visible
- Transfer hook enforcement still applies (blacklist checks)

### Allowlists

SSS-3 introduces an allowlist mechanism for controlling which addresses can participate in confidential transfers. Only allowlisted addresses can enable confidential transfer functionality on their token accounts.

**AllowlistEntry PDA:**
```
Seeds: ["allowlist", config, address]
```

**Account structure:**
| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | Associated stablecoin config |
| `address` | Pubkey | Allowed address |
| `bump` | u8 | PDA bump seed |

### Allowlist Management

Adding to allowlist:
- Requires master authority or designated role
- Creates AllowlistEntry PDA
- Address can then configure confidential transfers on their token account

Removing from allowlist:
- Closes AllowlistEntry PDA
- Address can no longer initiate new confidential transfers
- Existing confidential balances remain accessible

## Available Roles

All SSS-2 roles plus any SSS-3-specific roles:

| Role | ID | Purpose |
|---|---|---|
| Minter | 0 | Mint tokens |
| Burner | 1 | Burn tokens |
| Blacklister | 2 | Manage blacklist |
| Pauser | 3 | Pause/unpause |
| Seizer | 4 | Seize tokens |
| FreezeAuth | 5 | Freeze/thaw accounts |

## Privacy Model

### What Is Hidden

- Transfer amounts between confidential-enabled accounts
- Individual account balances (confidential portion)

### What Is Visible

- Transfer participants (sender and receiver addresses)
- Total token supply
- Public (non-confidential) balances
- Mint and burn amounts
- Blacklist entries
- Account freeze status

### Regulatory Compliance

SSS-3 maintains regulatory compliance through:

1. **Allowlists** -- Only approved addresses can use confidential transfers
2. **Auditor key** -- The config PDA can decrypt all confidential transfer amounts
3. **Blacklists** -- Blacklisted addresses cannot send or receive (enforced by transfer hook)
4. **Seizure** -- PermanentDelegate allows seizure of public balances
5. **Freeze** -- Frozen accounts cannot participate in any transfers

## Initialization

SSS-3 initialization includes all SSS-2 steps plus:

1. ConfidentialTransfer extension is added to the mint
2. Auditor configuration is set (config PDA as auditor)
3. Auto-approve policy can be configured

## Example: Deploy an SSS-3 Stablecoin

```typescript
const stablecoin = new SolanaStablecoin({
  connection,
  wallet: authority,
  preset: "SSS-3",
});

// Initialize with confidential transfer support
const { config, mint } = await stablecoin.initialize({
  configId: 0,
  decimals: 6,
  name: "Private USD",
  symbol: "PUSD",
  uri: "https://example.com/metadata.json",
});

// Initialize transfer hook
await stablecoin.initializeHook();

// Set up roles
await stablecoin.assignRole(minterWallet, Role.Minter);
await stablecoin.assignRole(blacklisterWallet, Role.Blacklister);
// ... other roles

// Add addresses to allowlist
await stablecoin.addToAllowlist(userAddress);

// User can now configure confidential transfers on their token account
```

## Differences from SSS-2

| Feature | SSS-2 | SSS-3 |
|---|---|---|
| Transfer amounts | Public | Optionally encrypted |
| Allowlist | Not used | Required for confidential transfers |
| ConfidentialTransfer extension | No | Yes |
| Account setup | Standard ATA | ATA + configure confidential transfer |
| Auditor | N/A | Config PDA (can decrypt all amounts) |

## Limitations

- Confidential transfers have higher compute costs due to zero-knowledge proof verification
- The ConfidentialTransfer extension adds complexity to token account management
- Seizure of confidential balances requires additional steps compared to public balances
- Not all wallets and explorers support confidential transfer display

## Implementation Status

SSS-3 features are available behind the `sss-3` feature flag in the sss-token program:

```toml
[features]
sss-3 = []
```

Build with SSS-3 support:
```bash
anchor build -- --features sss-3
```
