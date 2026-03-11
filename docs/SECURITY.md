# Security Model

## Overview

This document describes the security architecture of the Solana Stablecoin Standard, including the access control model, threat analysis, and security properties of each component.

## Access Control

### Role-Based Access Control (RBAC)

Access control is enforced entirely on-chain through PDA-based role assignments. A role exists if and only if the corresponding RoleAssignment PDA account exists.

```
Master Authority (sole admin)
  |
  +-- Can: assign_role, revoke_role, update_minter, initiate_authority_transfer
  |
  +-- Delegates to:
       +-- Minter (role=0)      -> mint_tokens
       +-- Burner (role=1)      -> burn_tokens
       +-- Blacklister (role=2) -> add/remove_from_blacklist
       +-- Pauser (role=3)      -> pause, unpause
       +-- Seizer (role=4)      -> seize
       +-- FreezeAuth (role=5)  -> freeze_account, thaw_account
```

### Role Enforcement Mechanisms

| Role | Enforcement | Method |
|---|---|---|
| Minter | MinterInfo PDA + active flag | `minter_info.active` check + PDA seeds constraint |
| Burner | RoleAssignment PDA | Seeds constraint with role byte `[1u8]` |
| Blacklister | RoleAssignment PDA | Seeds constraint with role byte `[2u8]` |
| Pauser | RoleAssignment PDA | Seeds constraint with role byte `[3u8]` |
| Seizer | RoleAssignment PDA | Seeds constraint with role byte `[4u8]` |
| FreezeAuth | RoleAssignment PDA | Seeds constraint with role byte `[5u8]` |
| Authority | Direct pubkey match | `config.master_authority == signer` constraint |

### PDA-Based Role Verification

Roles are verified by requiring the corresponding PDA as an account in the instruction. If the PDA does not exist on-chain, the transaction fails at the account validation stage before the instruction handler executes.

```rust
// Example: Burner role verification
#[account(
    seeds = [ROLE_SEED, config.key().as_ref(), burner.key().as_ref(), &[1u8]],
    bump = role_assignment.bump,
)]
pub role_assignment: Account<'info, RoleAssignment>,
```

## Authority Model

### Single Master Authority

Each stablecoin deployment has exactly one master authority. The authority:
- Is set during initialization
- Can only be changed through the two-step transfer process
- Controls all role assignments and minter configurations
- Is not required for day-to-day operations (delegated via roles)

### Two-Step Authority Transfer

Authority transfer requires two separate transactions from two different signers:

1. **Initiate** -- Current authority sets `pending_authority`
2. **Accept** -- New authority (matching `pending_authority`) completes the transfer

This prevents:
- Accidental transfer to the wrong address
- Transfer to an address that cannot sign (e.g., program address)
- Single-transaction authority theft

### Config PDA as Signing Authority

The config PDA serves as the signing authority for Token-2022 operations:
- **Mint authority** -- Signs `mint_to` CPI calls
- **Freeze authority** -- Signs `freeze_account` and `thaw_account` CPI calls
- **Permanent delegate** (SSS-2+) -- Signs `transfer_checked` during seizure
- **Metadata update authority** -- Signs metadata update calls

The config PDA signs using `invoke_signed` with seeds:
```
["stablecoin_config", authority_pubkey, config_id(u64 LE), bump]
```

## Threat Analysis

### Threat: Unauthorized Minting

**Attack vector:** An attacker attempts to mint tokens without authorization.

**Mitigations:**
1. Minting requires a valid MinterInfo PDA with `active = true`
2. Minting is capped by per-minter allowance (`total_minted <= allowance`)
3. Only the master authority can create/update MinterInfo PDAs
4. The mint authority is the config PDA, which can only sign via the program

**Residual risk:** If a minter's private key is compromised, the attacker can mint up to the remaining allowance. Mitigation: set conservative allowances, monitor mint events, maintain a pauser key for emergencies.

### Threat: Unauthorized Token Seizure

**Attack vector:** An attacker attempts to seize tokens from user accounts.

**Mitigations:**
1. Seizure requires a valid RoleAssignment PDA for the Seizer role (role=4)
2. Only the master authority can assign the Seizer role
3. The permanent delegate (config PDA) can only sign via the program
4. Seizure emits a `TokensSeized` event for audit

**Residual risk:** If the Seizer key is compromised, the attacker can seize tokens from any account. Mitigation: store Seizer key in cold storage, use multisig.

### Threat: Blacklist Bypass

**Attack vector:** A blacklisted user attempts to transfer tokens.

**Mitigations:**
1. Transfer hook is enforced by Token-2022 runtime on every `transfer_checked`
2. Hook checks blacklist PDA existence (data_len > 0)
3. Both source and destination are checked
4. Hook program cannot be bypassed when configured on the mint
5. The fallback handler catches non-Anchor invocations

**Residual risk:** Minting directly to a blacklisted address is not blocked by the transfer hook (minting uses `mint_to`, not `transfer_checked`). Mitigation: check blacklist status before minting in the backend/SDK layer.

### Threat: Authority Key Compromise

**Attack vector:** The master authority private key is stolen.

**Impact:** Full control over role management, minter configuration, and authority transfer.

**Mitigations:**
1. Store authority key in HSM or hardware wallet
2. Use authority key infrequently (delegate to roles)
3. Monitor `AuthorityTransferInitiated` events
4. If detected early, race to initiate a transfer to a safe key

**Residual risk:** If the attacker completes an authority transfer before detection, the original authority loses control. This is by design (on-chain finality). Mitigation: program upgrade authority can be used to deploy a patched version in extreme cases.

### Threat: Pause Denial of Service

**Attack vector:** A compromised Pauser key repeatedly pauses the stablecoin.

**Mitigations:**
1. Master authority can revoke the Pauser role at any time
2. Blacklist/seize/role management still works while paused
3. Authority transfer still works while paused
4. A new Pauser can be assigned and unpause the system

### Threat: Program Upgrade Attack

**Attack vector:** An attacker upgrades the program with malicious code.

**Mitigations:**
1. Program upgrade authority is separate from stablecoin authority
2. Upgrade authority can be transferred to a multisig
3. Upgrade authority can be revoked (making the program immutable)
4. Anchor's `declare_id!` macro prevents deploying to a different address

### Threat: PDA Collision

**Attack vector:** An attacker finds a PDA collision to create a fake role assignment.

**Mitigations:**
1. PDAs are derived using `Pubkey::find_program_address` with cryptographic hash
2. Seeds include the program ID, config key, holder key, and role byte
3. PDA collision requires breaking SHA-256 preimage resistance
4. Anchor validates PDA derivation in account constraints

## Invariants

### Core Invariants

1. **Supply tracking:** `config.total_minted >= config.total_burned` always holds
2. **Minter allowance:** `minter_info.total_minted <= minter_info.allowance` always holds
3. **Role exclusivity:** Only the master authority can assign or revoke roles
4. **Authority uniqueness:** Exactly one master authority exists at any time
5. **Pause state:** When paused, mint_tokens, burn_tokens, and freeze_account are blocked

### Checked Arithmetic

All arithmetic operations use Rust's `checked_add`, `checked_sub`, and `checked_mul` to prevent overflow:

```rust
minter_info.total_minted = minter_info
    .total_minted
    .checked_add(amount)
    .ok_or(SssError::Overflow)?;
```

### Preset Enforcement

Feature availability is checked at instruction time:

```rust
constraint = Preset::from_u8(config.preset)
    .map(|p| p.has_transfer_hook())
    .unwrap_or(false) @ SssError::FeatureNotAvailable,
```

This prevents SSS-1 deployments from accessing SSS-2+ features.

## Security Checklist for Deployers

- [ ] Authority keypair generated on air-gapped machine or HSM
- [ ] Authority keypair never exposed to internet-connected devices
- [ ] Pauser key stored in accessible but secure location (for emergencies)
- [ ] Seizer key in cold storage (infrequent use)
- [ ] Minter allowances set to conservative limits
- [ ] All role assignments documented and reviewed
- [ ] Program upgrade authority transferred to multisig or revoked
- [ ] Event monitoring configured with alerting
- [ ] Incident response plan documented and tested
- [ ] Regular role audit scheduled
- [ ] Treasury account verified and not blacklisted

## Anchor Security Features

The programs leverage Anchor's built-in security features:

| Feature | Purpose |
|---|---|
| `declare_id!` | Prevents program ID spoofing |
| `#[account]` | Discriminator-based account type validation |
| `has_one` | Cross-account reference validation |
| `seeds + bump` | PDA derivation and verification |
| `constraint` | Custom validation logic |
| `init` | Safe account initialization with discriminator |
| `close` | Safe account closure with rent return |
| `Signer<'info>` | Signature verification |

## Solana Runtime Security

| Property | Guarantee |
|---|---|
| Account ownership | Only the owning program can modify account data |
| Signer verification | The runtime verifies all `is_signer` flags |
| Rent exemption | All PDAs are created rent-exempt |
| CPI depth | Maximum 4 levels of CPI depth |
| Compute budget | Transactions have compute unit limits |
| Transaction atomicity | All instructions in a transaction succeed or all fail |
