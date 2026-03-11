# SDK Reference

## Package: `@stbr/sss-token`

The TypeScript SDK provides a high-level interface for interacting with the Solana Stablecoin Standard programs.

## Installation

```bash
npm install @stbr/sss-token
# or
yarn add @stbr/sss-token
```

## Quick Start

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const authority = Keypair.generate();

const stablecoin = new SolanaStablecoin({
  connection,
  wallet: authority,
  preset: "SSS-2",
});

// Initialize a new stablecoin
const { config, mint } = await stablecoin.initialize({
  configId: 0,
  decimals: 6,
  name: "USD Stablecoin",
  symbol: "USDS",
  uri: "https://example.com/metadata.json",
});

// Set up a minter with 1M allowance
await stablecoin.updateMinter(minterWallet, 1_000_000_000000, true);

// Mint tokens
await stablecoin.mint(recipientWallet, 100_000000);
```

## SolanaStablecoin Class

### Constructor

```typescript
new SolanaStablecoin(options: StablecoinOptions)
```

**Options:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `connection` | `Connection` | Yes | Solana RPC connection |
| `wallet` | `Keypair \| Wallet` | Yes | Signing wallet |
| `preset` | `"SSS-1" \| "SSS-2" \| "SSS-3"` | Yes | Preset level |
| `programId` | `PublicKey` | No | Override sss-token program ID |
| `hookProgramId` | `PublicKey` | No | Override transfer hook program ID |
| `configId` | `number` | No | Config identifier (default: 0) |

### Initialization

#### `initialize(params)`

Create a new stablecoin deployment.

```typescript
const result = await stablecoin.initialize({
  configId: 0,
  decimals: 6,
  name: "My Stablecoin",
  symbol: "MUSD",
  uri: "https://example.com/metadata.json",
});
// Returns: { config: PublicKey, mint: PublicKey, signature: string }
```

**Parameters:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| `configId` | `number` | u64 | Unique deployment identifier |
| `decimals` | `number` | 0-18 | Token decimal places |
| `name` | `string` | max 32 chars | Token name |
| `symbol` | `string` | max 10 chars | Token symbol |
| `uri` | `string` | max 200 chars | Metadata URI |

### Token Operations

#### `mint(recipient, amount)`

Mint tokens to a recipient. Caller must have the Minter role and sufficient allowance.

```typescript
await stablecoin.mint(recipientPublicKey, 1_000_000); // 1 USDS (6 decimals)
```

#### `burn(amount)`

Burn tokens from the caller's account. Caller must have the Burner role.

```typescript
await stablecoin.burn(500_000);
```

#### `freezeAccount(tokenAccount)`

Freeze a token account. Caller must have the FreezeAuth role.

```typescript
await stablecoin.freezeAccount(targetTokenAccount);
```

#### `thawAccount(tokenAccount)`

Thaw a frozen token account. Caller must have the FreezeAuth role.

```typescript
await stablecoin.thawAccount(targetTokenAccount);
```

### Pause Control

#### `pause()`

Pause all operations. Caller must have the Pauser role.

```typescript
await stablecoin.pause();
```

#### `unpause()`

Resume operations. Caller must have the Pauser role.

```typescript
await stablecoin.unpause();
```

### Role Management

#### `assignRole(holder, role)`

Assign a role to a wallet. Caller must be the master authority.

```typescript
import { Role } from "@stbr/sss-token";

await stablecoin.assignRole(walletPublicKey, Role.Minter);
await stablecoin.assignRole(walletPublicKey, Role.Blacklister);
```

#### `revokeRole(holder, role)`

Revoke a role from a wallet. Returns rent to the authority.

```typescript
await stablecoin.revokeRole(walletPublicKey, Role.Minter);
```

#### `updateMinter(minter, allowance, active)`

Configure a minter's allowance and active status. Caller must be the master authority. Creates the MinterInfo account if it does not exist.

```typescript
// Set up minter with 10M token allowance
await stablecoin.updateMinter(minterPublicKey, 10_000_000_000000, true);

// Deactivate minter
await stablecoin.updateMinter(minterPublicKey, 0, false);
```

### Authority Transfer

#### `initiateAuthorityTransfer(newAuthority)`

Begin a two-step authority transfer.

```typescript
await stablecoin.initiateAuthorityTransfer(newAuthorityPublicKey);
```

#### `acceptAuthority()`

Accept a pending authority transfer. Must be called by the pending authority.

```typescript
await stablecoin.acceptAuthority();
```

### Compliance (SSS-2+)

#### `addToBlacklist(address, reasonHash)`

Add an address to the blacklist. Caller must have the Blacklister role.

```typescript
const reasonHash = Buffer.alloc(32); // SHA-256 of reason string
await stablecoin.addToBlacklist(targetPublicKey, reasonHash);
```

#### `removeFromBlacklist(address)`

Remove an address from the blacklist. Returns rent to the blacklister.

```typescript
await stablecoin.removeFromBlacklist(targetPublicKey);
```

#### `seize(sourceTokenAccount, amount)`

Seize tokens from a frozen account to the treasury. Caller must have the Seizer role. The source account must already be frozen.

```typescript
await stablecoin.seize(frozenTokenAccount, 500_000);
```

### View Methods

#### `getConfig()`

Fetch the current stablecoin configuration.

```typescript
const config = await stablecoin.getConfig();
// Returns: StablecoinConfig
// {
//   masterAuthority: PublicKey,
//   pendingAuthority: PublicKey,
//   mint: PublicKey,
//   treasury: PublicKey,
//   transferHookProgram: PublicKey,
//   totalMinted: BN,
//   totalBurned: BN,
//   decimals: number,
//   paused: boolean,
//   preset: number,
//   configId: BN,
// }
```

#### `getMinterInfo(minter)`

Fetch a minter's allowance and usage.

```typescript
const info = await stablecoin.getMinterInfo(minterPublicKey);
// Returns: MinterInfo
// {
//   config: PublicKey,
//   minter: PublicKey,
//   allowance: BN,
//   totalMinted: BN,
//   active: boolean,
// }
```

#### `getRoleAssignment(holder, role)`

Check if a role assignment exists.

```typescript
const assignment = await stablecoin.getRoleAssignment(walletKey, Role.Pauser);
// Returns: RoleAssignment | null
```

#### `isBlacklisted(address)`

Check if an address is blacklisted (SSS-2+).

```typescript
const blacklisted = await stablecoin.isBlacklisted(addressPublicKey);
// Returns: boolean
```

## ComplianceModule

A specialized module for compliance-heavy workflows.

```typescript
import { ComplianceModule } from "@stbr/sss-token";

const compliance = new ComplianceModule(stablecoin);
```

### Methods

#### `blacklistAndFreeze(address, reasonHash)`

Blacklist an address and freeze all known token accounts in a single workflow.

```typescript
await compliance.blacklistAndFreeze(targetAddress, reasonHash);
```

#### `seizeAndBurn(sourceTokenAccount, amount)`

Seize tokens to treasury and immediately burn them.

```typescript
await compliance.seizeAndBurn(frozenAccount, amount);
```

#### `getBlacklistEntries()`

Fetch all blacklist entries for the stablecoin.

```typescript
const entries = await compliance.getBlacklistEntries();
// Returns: BlacklistEntry[]
```

#### `getAuditTrail(address)`

Fetch all compliance-related events for a specific address.

```typescript
const events = await compliance.getAuditTrail(targetAddress);
// Returns: ComplianceEvent[]
```

## PDA Helpers

Utility functions for deriving Program Derived Addresses.

```typescript
import {
  findConfigPda,
  findMintPda,
  findMinterPda,
  findRolePda,
  findBlacklistPda,
  findAllowlistPda,
  findHookConfigPda,
  findExtraMetasPda,
} from "@stbr/sss-token";
```

### `findConfigPda(programId, authority, configId)`

```typescript
const [configPda, bump] = findConfigPda(programId, authorityKey, 0);
// Seeds: ["stablecoin_config", authority, configId(u64 LE)]
```

### `findMintPda(programId, config)`

```typescript
const [mintPda, bump] = findMintPda(programId, configPda);
// Seeds: ["sss_mint", config]
```

### `findMinterPda(programId, config, minter)`

```typescript
const [minterPda, bump] = findMinterPda(programId, configPda, minterKey);
// Seeds: ["minter_info", config, minter]
```

### `findRolePda(programId, config, holder, role)`

```typescript
const [rolePda, bump] = findRolePda(programId, configPda, holderKey, Role.Minter);
// Seeds: ["role", config, holder, role_u8]
```

### `findBlacklistPda(programId, config, address)`

```typescript
const [blacklistPda, bump] = findBlacklistPda(programId, configPda, targetKey);
// Seeds: ["blacklist", config, address]
```

### `findHookConfigPda(hookProgramId, mint)`

```typescript
const [hookConfigPda, bump] = findHookConfigPda(hookProgramId, mintPda);
// Seeds: ["hook_config", mint]
```

### `findExtraMetasPda(hookProgramId, mint)`

```typescript
const [extraMetasPda, bump] = findExtraMetasPda(hookProgramId, mintPda);
// Seeds: ["extra-account-metas", mint]
```

## Types

### Role Enum

```typescript
enum Role {
  Minter = 0,
  Burner = 1,
  Blacklister = 2,
  Pauser = 3,
  Seizer = 4,
  FreezeAuth = 5,
}
```

### Preset Enum

```typescript
enum Preset {
  Minimal = 1,    // SSS-1
  Compliant = 2,  // SSS-2
  Private = 3,    // SSS-3
}
```

### Event Types

```typescript
interface TokensMintedEvent {
  config: PublicKey;
  minter: PublicKey;
  recipient: PublicKey;
  amount: BN;
  totalMinted: BN;
  minterAllowanceRemaining: BN;
}

interface TokensBurnedEvent {
  config: PublicKey;
  burner: PublicKey;
  amount: BN;
  totalBurned: BN;
}

interface AddressBlacklistedEvent {
  config: PublicKey;
  address: PublicKey;
  blacklistedBy: PublicKey;
  reasonHash: number[]; // 32 bytes
}

interface TokensSeizedEvent {
  config: PublicKey;
  from: PublicKey;
  toTreasury: PublicKey;
  amount: BN;
  seizedBy: PublicKey;
}
```

## Event Listener

```typescript
// Subscribe to all events
stablecoin.addEventListener("TokensMinted", (event) => {
  console.log(`Minted ${event.amount} to ${event.recipient}`);
});

stablecoin.addEventListener("AddressBlacklisted", (event) => {
  console.log(`Address ${event.address} blacklisted`);
});

// Unsubscribe
stablecoin.removeAllListeners();
```

## Error Handling

```typescript
import { SssError } from "@stbr/sss-token";

try {
  await stablecoin.mint(recipient, amount);
} catch (error) {
  if (error instanceof SssError) {
    switch (error.code) {
      case 6001: // Paused
        console.log("Stablecoin is paused");
        break;
      case 6010: // AllowanceExceeded
        console.log("Minter allowance exceeded");
        break;
      case 6020: // Blacklisted
        console.log("Address is blacklisted");
        break;
    }
  }
}
```
