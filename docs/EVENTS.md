# Event Reference

## Overview

The Solana Stablecoin Standard emits Anchor events for all state-changing operations. Events are logged in transaction metadata and can be parsed from program logs.

## sss-token Events

### StablecoinInitialized

Emitted when a new stablecoin is initialized via the `initialize` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `mint` | Pubkey | The Token-2022 mint address |
| `authority` | Pubkey | The master authority who initialized |
| `preset` | u8 | Preset level (1=SSS-1, 2=SSS-2, 3=SSS-3) |
| `decimals` | u8 | Token decimal places |
| `name` | String | Token name |
| `symbol` | String | Token symbol |

**Example log:**
```
Program data: <base64-encoded StablecoinInitialized event>
```

---

### TokensMinted

Emitted when tokens are minted via the `mint_tokens` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `minter` | Pubkey | The minter who signed the transaction |
| `recipient` | Pubkey | The recipient's token account |
| `amount` | u64 | Number of tokens minted (in base units) |
| `total_minted` | u64 | Cumulative tokens minted for this stablecoin |
| `minter_allowance_remaining` | u64 | Minter's remaining allowance after this mint |

---

### TokensBurned

Emitted when tokens are burned via the `burn_tokens` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `burner` | Pubkey | The burner who signed the transaction |
| `amount` | u64 | Number of tokens burned (in base units) |
| `total_burned` | u64 | Cumulative tokens burned for this stablecoin |

---

### AccountFrozen

Emitted when a token account is frozen via the `freeze_account` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `account` | Pubkey | The token account that was frozen |
| `authority` | Pubkey | The FreezeAuth who performed the freeze |

---

### AccountThawed

Emitted when a token account is thawed via the `thaw_account` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `account` | Pubkey | The token account that was thawed |
| `authority` | Pubkey | The FreezeAuth who performed the thaw |

---

### StablecoinPaused

Emitted when the stablecoin is paused via the `pause` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `authority` | Pubkey | The Pauser who paused the stablecoin |

---

### StablecoinUnpaused

Emitted when the stablecoin is unpaused via the `unpause` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `authority` | Pubkey | The Pauser who unpaused the stablecoin |

---

### MinterUpdated

Emitted when a minter's configuration is updated via the `update_minter` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `minter` | Pubkey | The minter wallet address |
| `allowance` | u64 | New cumulative allowance |
| `active` | bool | Whether the minter is active |

---

### RoleAssigned

Emitted when a role is assigned via the `assign_role` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `holder` | Pubkey | The wallet receiving the role |
| `role` | u8 | Role identifier (0-5) |
| `assigned_by` | Pubkey | The master authority who assigned the role |

**Role values:**
| Value | Role |
|---|---|
| 0 | Minter |
| 1 | Burner |
| 2 | Blacklister |
| 3 | Pauser |
| 4 | Seizer |
| 5 | FreezeAuth |

---

### RoleRevoked

Emitted when a role is revoked via the `revoke_role` instruction.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `holder` | Pubkey | The wallet losing the role |
| `role` | u8 | Role identifier (0-5) |
| `revoked_by` | Pubkey | The master authority who revoked the role |

---

### AuthorityTransferInitiated

Emitted when a two-step authority transfer is initiated via `initiate_authority_transfer`.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `current_authority` | Pubkey | The current master authority |
| `pending_authority` | Pubkey | The proposed new authority |

---

### AuthorityTransferred

Emitted when a two-step authority transfer is completed via `accept_authority`.

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `old_authority` | Pubkey | The previous master authority |
| `new_authority` | Pubkey | The new master authority |

---

### AddressBlacklisted

Emitted when an address is added to the blacklist via `add_to_blacklist` (SSS-2+).

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `address` | Pubkey | The blacklisted wallet address |
| `blacklisted_by` | Pubkey | The Blacklister who added the entry |
| `reason_hash` | [u8; 32] | SHA-256 hash of the reason string |

---

### AddressUnblacklisted

Emitted when an address is removed from the blacklist via `remove_from_blacklist` (SSS-2+).

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `address` | Pubkey | The unblacklisted wallet address |
| `removed_by` | Pubkey | The Blacklister who removed the entry |

---

### TokensSeized

Emitted when tokens are seized via the `seize` instruction (SSS-2+).

| Field | Type | Description |
|---|---|---|
| `config` | Pubkey | The config PDA address |
| `from` | Pubkey | The source token account |
| `to_treasury` | Pubkey | The treasury token account |
| `amount` | u64 | Number of tokens seized (in base units) |
| `seized_by` | Pubkey | The Seizer who performed the seizure |

## Parsing Events

### TypeScript (Anchor)

```typescript
import { Program } from "@coral-xyz/anchor";

// Listen for events in real-time
program.addEventListener("TokensMinted", (event, slot) => {
  console.log("Minted:", event.amount.toString());
  console.log("Minter:", event.minter.toBase58());
  console.log("Slot:", slot);
});

// Parse events from a transaction
const tx = await connection.getTransaction(signature, {
  commitment: "confirmed",
});

const eventParser = new anchor.EventParser(program.programId, program.coder);
const events = [];
eventParser.parseLogs(tx.meta.logMessages, (event) => {
  events.push(event);
});
```

### Filtering Events by Type

```typescript
// Get all blacklist events
const blacklistEvents = events.filter(
  (e) => e.name === "AddressBlacklisted" || e.name === "AddressUnblacklisted"
);

// Get all mint events for a specific minter
const minterEvents = events.filter(
  (e) => e.name === "TokensMinted" && e.data.minter.equals(minterPubkey)
);
```

## Event Summary

| Event | Instruction | Preset | Category |
|---|---|---|---|
| StablecoinInitialized | `initialize` | All | Lifecycle |
| TokensMinted | `mint_tokens` | All | Token |
| TokensBurned | `burn_tokens` | All | Token |
| AccountFrozen | `freeze_account` | All | Account |
| AccountThawed | `thaw_account` | All | Account |
| StablecoinPaused | `pause` | All | Control |
| StablecoinUnpaused | `unpause` | All | Control |
| MinterUpdated | `update_minter` | All | Admin |
| RoleAssigned | `assign_role` | All | Admin |
| RoleRevoked | `revoke_role` | All | Admin |
| AuthorityTransferInitiated | `initiate_authority_transfer` | All | Admin |
| AuthorityTransferred | `accept_authority` | All | Admin |
| AddressBlacklisted | `add_to_blacklist` | SSS-2+ | Compliance |
| AddressUnblacklisted | `remove_from_blacklist` | SSS-2+ | Compliance |
| TokensSeized | `seize` | SSS-2+ | Compliance |
