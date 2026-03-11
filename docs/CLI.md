# CLI Reference

## Overview

The `sss-token` CLI provides command-line access to all Solana Stablecoin Standard operations. It wraps the on-chain programs with convenient commands for deployment, management, and monitoring.

## Installation

```bash
npm install -g @stbr/sss-token-cli
# or
cargo install sss-token-cli
```

## Global Options

| Option | Short | Default | Description |
|---|---|---|---|
| `--url` | `-u` | `http://localhost:8899` | Solana RPC URL |
| `--keypair` | `-k` | `~/.config/solana/id.json` | Signer keypair path |
| `--program-id` | | `VuhEhak...` | Override sss-token program ID |
| `--hook-program-id` | | `5ADnkQ...` | Override transfer hook program ID |
| `--commitment` | `-c` | `confirmed` | Transaction commitment level |
| `--verbose` | `-v` | false | Show transaction details |

## Commands

### initialize

Create a new stablecoin deployment.

```bash
sss-token initialize \
  --preset <1|2|3> \
  --config-id <NUMBER> \
  --decimals <NUMBER> \
  --name <STRING> \
  --symbol <STRING> \
  --uri <STRING> \
  [--transfer-hook-program <PUBKEY>] \
  [--treasury <PUBKEY>]
```

**Arguments:**

| Argument | Required | Description |
|---|---|---|
| `--preset` | Yes | Preset level: 1 (Minimal), 2 (Compliant), 3 (Private) |
| `--config-id` | Yes | Unique identifier (u64) for this deployment |
| `--decimals` | Yes | Token decimal places (0-18) |
| `--name` | Yes | Token name (max 32 characters) |
| `--symbol` | Yes | Token symbol (max 10 characters) |
| `--uri` | Yes | Metadata URI (max 200 characters) |
| `--transfer-hook-program` | SSS-2+ | Transfer hook program ID |
| `--treasury` | No | Treasury token account for seized tokens |

**Example:**
```bash
sss-token initialize \
  --preset 2 \
  --config-id 0 \
  --decimals 6 \
  --name "USD Stablecoin" \
  --symbol "USDS" \
  --uri "https://example.com/metadata.json" \
  --transfer-hook-program 5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV \
  --keypair authority.json \
  --url devnet
```

**Output:**
```
Stablecoin initialized!
  Config:  7xKXtg2C...
  Mint:    4mNBYqt9...
  Preset:  SSS-2 (Compliant)
  Tx:      5vGtK7q1...
```

### hook initialize

Initialize the transfer hook (required for SSS-2 and SSS-3 after stablecoin initialization).

```bash
sss-token hook initialize \
  --config <PUBKEY> \
  --mint <PUBKEY>
```

**Example:**
```bash
sss-token hook initialize \
  --config 7xKXtg2C... \
  --mint 4mNBYqt9... \
  --keypair authority.json \
  --url devnet
```

### mint

Mint tokens to a recipient.

```bash
sss-token mint \
  --config <PUBKEY> \
  --recipient <PUBKEY> \
  --amount <NUMBER>
```

**Example:**
```bash
sss-token mint \
  --config 7xKXtg2C... \
  --recipient 9bT3qL4m... \
  --amount 1000000000 \
  --keypair minter.json \
  --url devnet
```

**Output:**
```
Minted 1,000.000000 USDS
  Recipient:    9bT3qL4m...
  Remaining:    999,000.000000
  Total Supply: 1,001,000.000000
  Tx:           3hF9yK2v...
```

### burn

Burn tokens from the signer's account.

```bash
sss-token burn \
  --config <PUBKEY> \
  --amount <NUMBER>
```

**Example:**
```bash
sss-token burn \
  --config 7xKXtg2C... \
  --amount 500000000 \
  --keypair burner.json \
  --url devnet
```

### freeze

Freeze a token account.

```bash
sss-token freeze \
  --config <PUBKEY> \
  --token-account <PUBKEY>
```

### thaw

Thaw a frozen token account.

```bash
sss-token thaw \
  --config <PUBKEY> \
  --token-account <PUBKEY>
```

### pause

Pause all operations.

```bash
sss-token pause --config <PUBKEY>
```

**Example:**
```bash
sss-token pause \
  --config 7xKXtg2C... \
  --keypair pauser.json \
  --url devnet
```

**Output:**
```
Stablecoin PAUSED
  Config: 7xKXtg2C...
  Tx:     2kM7pR5n...
```

### unpause

Resume operations.

```bash
sss-token unpause --config <PUBKEY>
```

### role assign

Assign a role to a wallet.

```bash
sss-token role assign \
  --config <PUBKEY> \
  --holder <PUBKEY> \
  --role <ROLE>
```

**Role values:** `minter`, `burner`, `blacklister`, `pauser`, `seizer`, `freeze-auth`

**Example:**
```bash
sss-token role assign \
  --config 7xKXtg2C... \
  --holder 5mQ8rT3k... \
  --role minter \
  --keypair authority.json \
  --url devnet
```

### role revoke

Revoke a role from a wallet.

```bash
sss-token role revoke \
  --config <PUBKEY> \
  --holder <PUBKEY> \
  --role <ROLE>
```

### minter update

Update minter allowance and status.

```bash
sss-token minter update \
  --config <PUBKEY> \
  --minter <PUBKEY> \
  --allowance <NUMBER> \
  --active <true|false>
```

**Example:**
```bash
sss-token minter update \
  --config 7xKXtg2C... \
  --minter 5mQ8rT3k... \
  --allowance 10000000000000 \
  --active true \
  --keypair authority.json \
  --url devnet
```

### authority transfer-initiate

Begin a two-step authority transfer.

```bash
sss-token authority transfer-initiate \
  --config <PUBKEY> \
  --new-authority <PUBKEY>
```

### authority transfer-accept

Accept a pending authority transfer.

```bash
sss-token authority transfer-accept \
  --config <PUBKEY>
```

### blacklist add

Add an address to the blacklist (SSS-2+).

```bash
sss-token blacklist add \
  --config <PUBKEY> \
  --address <PUBKEY> \
  --reason <STRING>
```

The `--reason` string is SHA-256 hashed before being stored on-chain.

**Example:**
```bash
sss-token blacklist add \
  --config 7xKXtg2C... \
  --address 3nR5tP8w... \
  --reason "OFAC SDN List - 2024-01-15" \
  --keypair blacklister.json \
  --url devnet
```

### blacklist remove

Remove an address from the blacklist (SSS-2+).

```bash
sss-token blacklist remove \
  --config <PUBKEY> \
  --address <PUBKEY>
```

### seize

Seize tokens from a frozen account (SSS-2+).

```bash
sss-token seize \
  --config <PUBKEY> \
  --source-token-account <PUBKEY> \
  --amount <NUMBER>
```

**Example:**
```bash
sss-token seize \
  --config 7xKXtg2C... \
  --source-token-account 8kV2nQ4j... \
  --amount 1000000000 \
  --keypair seizer.json \
  --url devnet
```

### view config

Display stablecoin configuration.

```bash
sss-token view config --config <PUBKEY>
```

**Output:**
```
Stablecoin Configuration
  Config:         7xKXtg2C...
  Authority:      2pL6mR9v...
  Mint:           4mNBYqt9...
  Treasury:       6wT4nK3f...
  Preset:         SSS-2 (Compliant)
  Decimals:       6
  Paused:         No
  Total Minted:   1,000,000.000000
  Total Burned:   50,000.000000
  Current Supply: 950,000.000000
  Hook Program:   5ADnkQpQ...
```

### view minter

Display minter information.

```bash
sss-token view minter \
  --config <PUBKEY> \
  --minter <PUBKEY>
```

**Output:**
```
Minter Information
  Minter:      5mQ8rT3k...
  Allowance:   10,000,000.000000
  Minted:      1,000,000.000000
  Remaining:   9,000,000.000000
  Active:      Yes
```

### view minters

List all minters for a stablecoin.

```bash
sss-token view minters --config <PUBKEY>
```

### compliance check-blacklist

Check if an address is blacklisted.

```bash
sss-token compliance check-blacklist \
  --config <PUBKEY> \
  --address <PUBKEY>
```

**Output:**
```
Address 3nR5tP8w... is BLACKLISTED
  Blacklisted by: 7kQ2mL5r...
  Reason hash:    a1b2c3d4...
  Date:           2024-01-15 10:30:00 UTC
```

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Transaction failed (on-chain error) |
| 2 | Invalid arguments |
| 3 | RPC connection error |
| 4 | Keypair file not found or invalid |
| 5 | Account not found |

## Environment Variables

| Variable | Description |
|---|---|
| `ANCHOR_PROVIDER_URL` | Default RPC URL |
| `ANCHOR_WALLET` | Default keypair path |
| `SSS_PROGRAM_ID` | Override sss-token program ID |
| `SSS_HOOK_PROGRAM_ID` | Override transfer hook program ID |
