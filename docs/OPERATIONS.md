# Operations Guide

## Overview

This guide covers day-to-day operational procedures for running a Solana Stablecoin Standard deployment, including monitoring, key management, incident response, and maintenance.

## Key Management

### Key Hierarchy

```
    Master Authority Keypair (cold storage)
         |
         +-- Initiates authority transfers
         +-- Assigns/revokes roles
         +-- Updates minter allowances
         |
         +---> Minter Keypair(s) (warm storage)
         |       Mints tokens within allowance
         |
         +---> Burner Keypair (warm storage)
         |       Burns tokens from own account
         |
         +---> Pauser Keypair (hot standby)
         |       Emergency pause capability
         |
         +---> FreezeAuth Keypair (warm storage)
         |       Freezes/thaws individual accounts
         |
         +---> Blacklister Keypair (warm storage, SSS-2+)
         |       Manages blacklist entries
         |
         +---> Seizer Keypair (cold storage, SSS-2+)
                Seizes tokens from frozen accounts
```

### Storage Recommendations

| Key | Storage Type | Access Frequency | Notes |
|---|---|---|---|
| Master Authority | Hardware wallet / HSM | Rare | Used only for role management and authority transfer |
| Pauser | Hot wallet (monitored) | Emergency only | Must be available 24/7 for circuit-breaker |
| Minter | KMS / warm wallet | Frequent | Accessed by minting services |
| Burner | KMS / warm wallet | Moderate | Accessed by redemption services |
| FreezeAuth | Warm wallet | On-demand | Compliance-driven actions |
| Blacklister | Warm wallet | On-demand | Compliance-driven actions (SSS-2+) |
| Seizer | Cold storage / multisig | Rare | High-impact action (SSS-2+) |

### Authority Transfer Procedure

1. **Prepare** -- Generate new authority keypair in secure environment
2. **Initiate** -- Current authority calls `initiate_authority_transfer`
3. **Verify** -- Confirm `AuthorityTransferInitiated` event on-chain
4. **Accept** -- New authority calls `accept_authority`
5. **Validate** -- Fetch config and verify `master_authority` updated
6. **Archive** -- Securely archive old authority keypair

```bash
# Step 2: Initiate
sss-token authority transfer-initiate \
  --config <CONFIG_PUBKEY> \
  --new-authority <NEW_AUTHORITY_PUBKEY> \
  --keypair <CURRENT_AUTHORITY_KEYPAIR>

# Step 4: Accept
sss-token authority transfer-accept \
  --config <CONFIG_PUBKEY> \
  --keypair <NEW_AUTHORITY_KEYPAIR>
```

## Monitoring

### Key Metrics

| Metric | Source | Alert Threshold |
|---|---|---|
| Total Supply | `config.total_minted - config.total_burned` | Deviation from reserves |
| Mint Rate | `TokensMinted` events | Unusual spikes |
| Burn Rate | `TokensBurned` events | Unusual spikes |
| Pause Status | `config.paused` | Any change |
| Active Minters | `MinterInfo` accounts | Unauthorized additions |
| Blacklist Size | `BlacklistEntry` count | Rapid growth |
| Seized Amount | `TokensSeized` events | Any occurrence |
| Authority Changes | `AuthorityTransferred` events | Any occurrence |

### Event Monitoring

Subscribe to program events via WebSocket for real-time monitoring:

```typescript
import { Connection } from "@solana/web3.js";

const connection = new Connection("wss://api.mainnet-beta.solana.com");

// Monitor all sss-token program logs
connection.onLogs(SSS_TOKEN_PROGRAM_ID, (logs) => {
  // Parse Anchor events from log data
  for (const log of logs.logs) {
    if (log.startsWith("Program data:")) {
      const eventData = parseAnchorEvent(log);
      handleEvent(eventData);
    }
  }
});
```

### Health Checks

Implement the following periodic health checks:

1. **Config Integrity** -- Fetch config every 60s, verify authority and pause state
2. **Supply Reconciliation** -- Compare on-chain supply with off-chain reserve records
3. **Role Audit** -- Enumerate all RoleAssignment PDAs, verify against expected set
4. **Minter Allowance** -- Check remaining allowances, alert when low
5. **Program Upgrade Authority** -- Verify program upgrade authority matches expectations

### Dashboard Queries

```bash
# Check current supply
sss-token view config --config <CONFIG_PUBKEY>

# List all minters
sss-token view minters --config <CONFIG_PUBKEY>

# Check if address is blacklisted
sss-token compliance check-blacklist --config <CONFIG_PUBKEY> --address <ADDRESS>
```

## Incident Response

### Emergency Pause

If suspicious activity is detected, pause the stablecoin immediately:

```bash
sss-token pause --config <CONFIG_PUBKEY> --keypair <PAUSER_KEYPAIR>
```

When paused, the following operations are blocked:
- `mint_tokens`
- `burn_tokens`
- `freeze_account` (direct freeze; seize still works)

Operations that remain available while paused:
- `unpause`
- `assign_role` / `revoke_role`
- `update_minter`
- `add_to_blacklist` / `remove_from_blacklist`
- `seize`
- `thaw_account`
- `initiate_authority_transfer` / `accept_authority`
- View instructions

### Compromised Key Response

**Minter key compromised:**
1. Immediately deactivate the minter: `update_minter --active false`
2. Pause if unauthorized minting occurred
3. Assess damage (check `TokensMinted` events)
4. Generate new minter keypair
5. Update minter with new keypair
6. Unpause when safe

**Authority key compromised:**
1. If authority transfer has not been initiated by the attacker, immediately initiate transfer to a new key
2. If attacker has initiated transfer, race to initiate a different transfer (last write wins, pending is overwritten)
3. If attacker has already accepted transfer, the authority is lost -- this is unrecoverable without program upgrade

**Pauser key compromised:**
1. Authority revokes the Pauser role from compromised key
2. Assign Pauser role to new keypair
3. If attacker paused the system, unpause with the new Pauser

### Blacklist Emergency (SSS-2+)

For sanctioned address discovered holding tokens:

1. Blacklist the address: `add_to_blacklist`
2. Freeze the token account: `freeze_account`
3. Transfers are now blocked by both the transfer hook and the frozen state
4. If seizure required: `seize` (transfers to treasury, account remains frozen)

## Minter Management

### Adding a New Minter

```bash
# 1. Assign the Minter role
sss-token role assign \
  --config <CONFIG_PUBKEY> \
  --holder <MINTER_PUBKEY> \
  --role minter \
  --keypair <AUTHORITY_KEYPAIR>

# 2. Set allowance
sss-token minter update \
  --config <CONFIG_PUBKEY> \
  --minter <MINTER_PUBKEY> \
  --allowance 1000000000000 \
  --active true \
  --keypair <AUTHORITY_KEYPAIR>
```

### Rotating Minter Allowance

When a minter's allowance is exhausted, update it:

```bash
sss-token minter update \
  --config <CONFIG_PUBKEY> \
  --minter <MINTER_PUBKEY> \
  --allowance 2000000000000 \
  --active true \
  --keypair <AUTHORITY_KEYPAIR>
```

Note: `allowance` is cumulative. If the minter has already minted 1M, setting allowance to 2M gives them 1M more to mint.

### Deactivating a Minter

```bash
# Deactivate (keeps history)
sss-token minter update \
  --config <CONFIG_PUBKEY> \
  --minter <MINTER_PUBKEY> \
  --allowance 0 \
  --active false \
  --keypair <AUTHORITY_KEYPAIR>

# Optionally revoke the role entirely
sss-token role revoke \
  --config <CONFIG_PUBKEY> \
  --holder <MINTER_PUBKEY> \
  --role minter \
  --keypair <AUTHORITY_KEYPAIR>
```

## Maintenance

### Program Upgrades

The programs are deployed as upgradeable BPF programs. To upgrade:

1. Build the new program: `anchor build`
2. Verify the program binary
3. Deploy to devnet first and run all tests
4. Schedule mainnet upgrade during low-traffic period
5. Deploy: `anchor upgrade --program-id <PROGRAM_ID> --provider.cluster mainnet`
6. Verify the deployment matches the expected binary

### Rent Management

All PDA accounts are rent-exempt. Monitor the deployer's SOL balance for creating new accounts:

- Each `RoleAssignment` PDA costs approximately 0.002 SOL in rent
- Each `MinterInfo` PDA costs approximately 0.002 SOL
- Each `BlacklistEntry` PDA costs approximately 0.002 SOL
- Closing PDAs (revoking roles, removing from blacklist) returns rent to the payer

### Backup Procedures

1. **Config Snapshot** -- Regularly export config state: authority, mint, treasury, preset, totals
2. **Role Registry** -- Maintain an off-chain record of all assigned roles
3. **Minter Registry** -- Track all minter addresses and their allowances
4. **Blacklist Export** -- Periodically export all blacklist entries
5. **Transaction History** -- Archive all program transactions and events
