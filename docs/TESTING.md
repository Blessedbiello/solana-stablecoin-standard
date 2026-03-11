# Testing Guide

## Overview

The Solana Stablecoin Standard uses a multi-layered testing strategy covering unit tests, integration tests, and end-to-end tests against a local Solana validator.

## Test Structure

```
sol_stablecoin_standard/
  modules/
    sss-math/src/lib.rs          # Unit tests (pure Rust, no_std)
  tests/
    helpers/
      setup.ts                    # Test utilities, PDA helpers, initialization
      assertions.ts               # Custom assertion helpers
    sss-1.ts                      # SSS-1 Minimal preset tests
    sss-2.ts                      # SSS-2 Compliant preset tests
    roles.ts                      # RBAC role management tests
    transfer-hook.ts              # Transfer hook integration tests
    multi-user.ts                 # Multi-user scenario tests
    edge-cases.ts                 # Edge cases and error conditions
```

## Running Tests

### All Integration Tests

```bash
# Starts a local validator, deploys programs, runs all tests
anchor test
```

### Unit Tests Only

```bash
# Run pure Rust unit tests (no validator required)
cargo test -p sss-math
```

### Specific Test File

```bash
# Run a specific test file
anchor test -- --grep "SSS-1"
```

### With Verbose Output

```bash
# Show transaction logs
ANCHOR_LOG=true anchor test
```

## Test Categories

### SSS-1: Minimal Preset Tests (`sss-1.ts`)

Tests for the base stablecoin functionality:

| Test | Description |
|---|---|
| Initialization | Creates config with correct state |
| Mint creation | Token-2022 mint exists with correct owner |
| Mint tokens | Minter can mint within allowance |
| Burn tokens | Burner can burn from own account |
| Freeze account | FreezeAuth can freeze a token account |
| Thaw account | FreezeAuth can thaw a frozen account |
| Pause | Pauser can pause operations |
| Unpause | Pauser can resume operations |
| Mint while paused | Minting fails when paused |
| Burn while paused | Burning fails when paused |
| Authority transfer | Two-step authority transfer completes |
| Multiple configs | Same authority can create multiple stablecoins |

### SSS-2: Compliant Preset Tests (`sss-2.ts`)

Tests for compliance features:

| Test | Description |
|---|---|
| Initialization with hook | SSS-2 creates mint with TransferHook + PermanentDelegate |
| Blacklist add | Blacklister can add address to blacklist |
| Blacklist remove | Blacklister can remove address from blacklist |
| Transfer blocked | Blacklisted source cannot transfer |
| Receive blocked | Blacklisted destination cannot receive |
| Seize tokens | Seizer can seize from frozen account |
| Seize to treasury | Seized tokens arrive at treasury |
| Re-freeze after seize | Account remains frozen after seizure |

### Role Management Tests (`roles.ts`)

| Test | Description |
|---|---|
| Assign role | Authority assigns a role to a holder |
| Revoke role | Authority revokes a role |
| Unauthorized assign | Non-authority cannot assign roles |
| Unauthorized revoke | Non-authority cannot revoke roles |
| SSS-2 roles on SSS-1 | Blacklister/Seizer assignment fails on SSS-1 |
| Multiple roles | One wallet can hold multiple roles |
| Role after revoke | Revoked role holder cannot perform action |

### Transfer Hook Tests (`transfer-hook.ts`)

| Test | Description |
|---|---|
| Hook initialization | ExtraAccountMetas created correctly |
| Clean transfer | Transfer succeeds when neither party blacklisted |
| Source blacklisted | Transfer fails when source is blacklisted |
| Destination blacklisted | Transfer fails when destination is blacklisted |
| Both blacklisted | Transfer fails when both are blacklisted |
| After removal | Transfer succeeds after blacklist removal |

### Multi-User Tests (`multi-user.ts`)

| Test | Description |
|---|---|
| Multiple minters | Multiple minters can mint independently |
| Minter allowance tracking | Each minter's allowance is tracked separately |
| Role separation | Different users hold different roles |
| Concurrent operations | Multiple operations in same block |

### Edge Case Tests (`edge-cases.ts`)

| Test | Description |
|---|---|
| Zero mint | Minting zero amount fails |
| Zero burn | Burning zero amount fails |
| Allowance exceeded | Minting beyond allowance fails |
| Inactive minter | Inactive minter cannot mint |
| Double pause | Pausing while paused fails |
| Double unpause | Unpausing while not paused fails |
| Invalid preset | Preset 0 or 4+ fails |
| Name too long | Name exceeding 32 chars fails |
| Symbol too long | Symbol exceeding 10 chars fails |
| Decimals too high | Decimals > 18 fails |
| Self authority transfer | Authority can transfer to different address |
| Accept without initiate | Accept fails without pending authority |
| Wrong acceptor | Non-pending authority cannot accept |

## Test Helpers

### `setup.ts`

Provides reusable test utilities:

```typescript
// PDA derivation helpers
findConfigPda(programId, authority, configId)
findMintPda(programId, config)
findMinterPda(programId, config, minter)
findRolePda(programId, config, holder, role)
findBlacklistPda(programId, config, address)
findHookConfigPda(hookProgramId, mint)
findExtraMetasPda(hookProgramId, mint)

// Account helpers
getTokenAccount(mint, owner)           // Derive ATA address
createTokenAccount(provider, mint, owner)  // Create ATA on-chain

// Setup helpers
initializeStablecoin(program, provider, preset, hookProgram?, options?)
assignRole(program, authority, config, holder, role)
setupMinter(program, provider, authority, config, minter, allowance)

// Utility
airdrop(provider, address, amount?)
```

### `assertions.ts`

Custom assertion helpers:

```typescript
// Assert a transaction fails with a specific error
expectError(fn, errorCode)
expectError(fn, "Paused")

// Assert BN values
expectBN(actual, expected)

// Assert PublicKey values
expectPublicKey(actual, expected)
```

## Writing New Tests

### Test Template

```typescript
import { expect } from "chai";
import {
  getPrograms,
  initializeStablecoin,
  Preset,
  Role,
  StablecoinSetup,
} from "./helpers/setup";
import { expectError } from "./helpers/assertions";

describe("My Feature", () => {
  const { provider, program, hookProgram } = getPrograms();
  let setup: StablecoinSetup;

  before(async () => {
    setup = await initializeStablecoin(program, provider, Preset.Compliant, hookProgram);
  });

  it("should do something", async () => {
    // Arrange
    // ...

    // Act
    const tx = await program.methods
      .someInstruction(args)
      .accounts({ /* ... */ })
      .signers([signer])
      .rpc();

    // Assert
    const account = await program.account.someAccount.fetch(address);
    expect(account.field).to.equal(expectedValue);
  });

  it("should fail when unauthorized", async () => {
    await expectError(
      () => program.methods
        .someInstruction(args)
        .accounts({ /* ... */ })
        .signers([unauthorizedSigner])
        .rpc(),
      "Unauthorized"
    );
  });
});
```

### Testing Blacklist Enforcement

```typescript
it("blocks transfer to blacklisted address", async () => {
  // 1. Initialize SSS-2 stablecoin
  // 2. Initialize transfer hook
  // 3. Set up minter and mint tokens
  // 4. Blacklist the recipient
  // 5. Attempt transfer_checked
  // 6. Assert failure with DestinationBlacklisted
});
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: coral-xyz/setup-anchor@v0.32.1
      - run: yarn install
      - run: cargo test -p sss-math
      - run: anchor test
```

## Test Coverage Expectations

| Area | Expected Coverage |
|---|---|
| Instruction handlers | All instructions tested (happy path + error paths) |
| Role enforcement | Every role verified for access and denial |
| Preset enforcement | SSS-2 features rejected on SSS-1 |
| Arithmetic | Overflow/underflow conditions tested |
| State transitions | Pause/unpause, freeze/thaw, blacklist add/remove |
| Authority transfer | Full two-step flow + error conditions |
| Transfer hook | Source/dest blacklist checks, fallback handler |
