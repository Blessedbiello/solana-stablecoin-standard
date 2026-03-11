# Oracle Module

## Overview

The oracle module enables peg monitoring for stablecoins by reading price feeds from on-chain oracles. It allows issuers and third parties to verify that a stablecoin is trading within an acceptable range of its target peg. The current implementation supports Switchboard V2 aggregator feeds, with Pyth planned as a future extension.

The module spans two layers:
- **sss-oracle** -- A shared Rust module providing PDA derivation and feed freshness validation
- **sss-token instructions** -- Two on-chain instructions (`configure_oracle`, `check_peg`) that manage oracle configuration and perform peg checks

**Program ID (sss-token):** `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB`

## OracleConfig Account

The `OracleConfig` PDA stores the oracle feed parameters for a given stablecoin configuration.

**PDA Seeds:** `["oracle_config", config]`

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | Parent stablecoin config account |
| `feed` | Pubkey | Switchboard V2 aggregator account |
| `max_staleness` | i64 | Maximum age in seconds before a feed is considered stale |
| `target_peg` | u64 | Target price in feed decimals (e.g., `1_000_000` for $1.00 with 6 decimals) |
| `deviation_threshold_bps` | u16 | Maximum acceptable deviation in basis points (e.g., `100` = 1%) |
| `bump` | u8 | PDA bump seed |

### PDA Derivation

```rust
use sss_oracle::find_oracle_config;

let (oracle_config_pda, bump) = find_oracle_config(&program_id, &stablecoin_config);
```

## Instructions

### configure_oracle

Creates or updates the `OracleConfig` for a stablecoin. This instruction is restricted to the master authority of the parent stablecoin config.

**Accounts:**

| Account | Signer | Writable | Description |
|---|---|---|---|
| `authority` | Yes | No | Master authority of the stablecoin config |
| `config` | No | No | StablecoinConfig PDA |
| `oracle_config` | No | Yes | OracleConfig PDA (init-if-needed) |
| `feed` | No | No | Switchboard V2 aggregator account |
| `system_program` | No | No | System program |

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `max_staleness` | i64 | Seconds before feed is stale (recommended: 60-300) |
| `target_peg` | u64 | Target price in feed decimals |
| `deviation_threshold_bps` | u16 | Deviation threshold in basis points |

**Validation:**
- `authority` must match `config.master_authority`
- `max_staleness` must be greater than zero
- `target_peg` must be greater than zero
- `deviation_threshold_bps` must be in range 1..10000

### check_peg

Reads the configured oracle feed, validates freshness, computes deviation from the target peg, and emits a `PegCheckEvent`. This instruction is permissionless -- anyone can call it.

**Accounts:**

| Account | Signer | Writable | Description |
|---|---|---|---|
| `config` | No | No | StablecoinConfig PDA |
| `oracle_config` | No | No | OracleConfig PDA |
| `feed` | No | No | Switchboard V2 aggregator account (must match `oracle_config.feed`) |

**Emits: PegCheckEvent**

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | Stablecoin config address |
| `feed` | Pubkey | Feed account that was read |
| `current_price` | u64 | Price read from the aggregator |
| `target_peg` | u64 | Configured target peg value |
| `deviation_bps` | u16 | Computed deviation in basis points |
| `is_within_threshold` | bool | Whether deviation is within the configured threshold |
| `timestamp` | i64 | Clock timestamp at time of check |

**Validation:**
- `feed` account must match `oracle_config.feed`
- Feed must pass staleness check via `is_feed_fresh()`
- If the feed is stale, the instruction returns an `OracleFeedStale` error

## sss-math Integration

The oracle module relies on two functions from the `sss-math` crate:

### is_feed_fresh

Defined in `sss-oracle` (delegates to subtraction logic consistent with sss-math conventions):

```rust
pub fn is_feed_fresh(last_updated: i64, current_time: i64, max_staleness: i64) -> bool {
    current_time.saturating_sub(last_updated) <= max_staleness
}
```

Returns `true` if the feed was updated within `max_staleness` seconds of `current_time`. Uses saturating subtraction to avoid underflow if clocks are skewed.

### exceeds_deviation

Defined in `sss-math`:

```rust
pub fn exceeds_deviation(actual: u64, target: u64, threshold_bps: u64) -> bool {
    if target == 0 {
        return actual != 0;
    }
    let diff = abs_diff(actual, target);
    // diff / target > threshold_bps / MAX_BPS
    // => diff * MAX_BPS > threshold_bps * target (avoiding division)
    let lhs = (diff as u128) * (MAX_BPS as u128);
    let rhs = (threshold_bps as u128) * (target as u128);
    lhs > rhs
}
```

Uses cross-multiplication to avoid division and maintain precision. Returns `true` when the price has deviated beyond the allowed threshold. The `check_peg` instruction sets `is_within_threshold = !exceeds_deviation(current_price, target_peg, deviation_threshold_bps)`.

## Supported Oracles

### Switchboard V2 (Current)

The module reads from Switchboard V2 `AggregatorAccountData`. The aggregator's `latest_confirmed_round.result` is converted to a `u64` in the feed's decimal precision and compared against `target_peg`.

Key fields read from the aggregator:
- `latest_confirmed_round.result` -- The current median price
- `latest_confirmed_round.round_open_timestamp` -- Used for staleness validation

### Pyth (Future Extension)

Pyth support is planned but not yet implemented. When added, the `OracleConfig` will include an oracle type discriminator to select the correct deserialization path. The same `check_peg` interface will be preserved.

## Usage Examples

### Configure Oracle

```typescript
import { PublicKey } from "@solana/web3.js";
import { SSSClient } from "@sss/sdk";

const client = new SSSClient(connection, wallet);

// Switchboard SOL/USD aggregator (example)
const feedAccount = new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR");

await client.configureOracle({
  config: stablecoinConfigPda,
  feed: feedAccount,
  maxStaleness: 120,                // 2 minutes
  targetPeg: 1_000_000,             // $1.00 with 6 decimals
  deviationThresholdBps: 100,       // 1%
});
```

### Check Peg

```typescript
const tx = await client.checkPeg({
  config: stablecoinConfigPda,
});

// Parse the PegCheckEvent from transaction logs
const events = await client.parseEvents(tx);
const pegCheck = events.find((e) => e.name === "PegCheckEvent");

console.log("Current price:", pegCheck.data.currentPrice.toString());
console.log("Deviation (bps):", pegCheck.data.deviationBps);
console.log("Within threshold:", pegCheck.data.isWithinThreshold);
```

### Automated Monitoring

```typescript
// Poll peg status on an interval
setInterval(async () => {
  try {
    const tx = await client.checkPeg({ config: stablecoinConfigPda });
    const events = await client.parseEvents(tx);
    const pegCheck = events.find((e) => e.name === "PegCheckEvent");

    if (!pegCheck.data.isWithinThreshold) {
      console.error(
        "PEG DEVIATION ALERT:",
        pegCheck.data.deviationBps, "bps"
      );
      // Trigger alerting pipeline
    }
  } catch (err) {
    if (err.message.includes("OracleFeedStale")) {
      console.error("Oracle feed is stale -- check aggregator health");
    }
  }
}, 30_000); // every 30 seconds
```

## Security Considerations

### Feed Manipulation

Switchboard aggregators derive their result from a median of multiple oracle node responses, which provides resistance to single-node manipulation. However:
- Use well-established feeds with a sufficient number of active oracles
- Avoid low-liquidity feeds where a single DEX can dominate the price
- Monitor for sudden feed value changes that may indicate oracle compromise

### Staleness Windows

The `max_staleness` parameter controls how old a feed can be before `check_peg` rejects it. Setting this value involves a trade-off:
- **Too low** (e.g., <30s) -- May cause frequent `OracleFeedStale` errors during network congestion or aggregator delays
- **Too high** (e.g., >600s) -- May accept outdated prices that no longer reflect market conditions

Recommended range: 60-300 seconds, depending on the feed's update frequency and the stablecoin's risk tolerance.

### Deviation Thresholds

The `deviation_threshold_bps` determines what constitutes an acceptable peg. Consider:
- Stablecoins with deep liquidity can use tighter thresholds (25-50 bps)
- Stablecoins with thinner markets may need wider thresholds (100-200 bps)
- Set thresholds based on historical price data for the specific stablecoin
- `check_peg` is informational -- it emits an event but does not block minting or transfers. Automated responses (pause, alert) must be built in the backend or monitoring layer.

### Feed Account Validation

The `configure_oracle` instruction stores the feed pubkey, and `check_peg` validates that the passed feed account matches. This prevents an attacker from substituting a different aggregator at call time. The authority should verify the feed account corresponds to the correct price pair before calling `configure_oracle`.
