# Solana Stablecoin Standard (SSS)

A production-grade framework for deploying regulated stablecoins on Solana using Token-2022 extensions. Choose from three preset levels to match your compliance requirements -- from minimal issuance to fully compliant with blacklists, seizure, and confidential transfers.

```
                    Solana Stablecoin Standard
    =====================================================

    +---------------------------------------------------+
    |                   Applications                     |
    |   CLI (sss-token)   |   SDK (@stbr/sss-token)     |
    +---------------------------------------------------+
    |                  Backend Services                  |
    |   REST API   |   Webhooks   |   Monitoring         |
    +---------------------------------------------------+
    |                 On-Chain Programs                   |
    |  +---------------------------------------------+  |
    |  |              sss-token (Anchor)              |  |
    |  |  initialize | mint | burn | freeze | pause   |  |
    |  |  blacklist | seize | roles | authority       |  |
    |  +---------------------------------------------+  |
    |  |         sss-transfer-hook (Anchor)           |  |
    |  |  Blacklist enforcement on every transfer     |  |
    |  +---------------------------------------------+  |
    +---------------------------------------------------+
    |                  Shared Modules                     |
    |  sss-math  |  sss-roles  |  sss-compliance        |
    |  sss-oracle                                        |
    +---------------------------------------------------+
    |                   Solana Runtime                    |
    |  Token-2022 | MetadataPointer | PermanentDelegate  |
    |  TransferHook | ConfidentialTransfer               |
    +---------------------------------------------------+
```

## Feature Highlights

- **Three Preset Levels** -- SSS-1 (Minimal), SSS-2 (Compliant), SSS-3 (Private)
- **Token-2022 Native** -- MetadataPointer, PermanentDelegate, TransferHook extensions
- **RBAC with 6 Roles** -- Minter, Burner, Blacklister, Pauser, Seizer, FreezeAuth
- **Compliance Built-In** -- Blacklisting, token seizure, account freezing, pause
- **Transfer Hook Enforcement** -- Blacklist checks on every transfer via CPI
- **Two-Step Authority Transfer** -- Safe ownership handoff with initiate/accept pattern
- **Minter Allowance System** -- Per-minter caps with on-chain tracking
- **PDA-Based Architecture** -- Deterministic account derivation, no off-chain state

## Preset Comparison

| Feature | SSS-1 Minimal | SSS-2 Compliant | SSS-3 Private |
|---|:---:|:---:|:---:|
| Mint / Burn | Yes | Yes | Yes |
| Freeze / Thaw | Yes | Yes | Yes |
| Pause / Unpause | Yes | Yes | Yes |
| Role Management | Yes | Yes | Yes |
| Minter Allowances | Yes | Yes | Yes |
| Authority Transfer | Yes | Yes | Yes |
| MetadataPointer | Yes | Yes | Yes |
| Transfer Hook | -- | Yes | Yes |
| Blacklisting | -- | Yes | Yes |
| PermanentDelegate | -- | Yes | Yes |
| Token Seizure | -- | Yes | Yes |
| Confidential Transfers | -- | -- | Yes |
| Allowlists | -- | -- | Yes |

## Quick Start

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32.1
- Node.js 18+

### Build

```bash
# Clone the repository
git clone https://github.com/your-org/sol_stablecoin_standard.git
cd sol_stablecoin_standard

# Install dependencies
yarn install

# Build both programs
anchor build
```

### Test

```bash
# Run on-chain integration tests (starts local validator)
anchor test

# Run pure Rust module tests
cargo test -p sss-math
```

### Deploy to Devnet

```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

## Program IDs

| Program | ID |
|---|---|
| sss-token | `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB` |
| sss-transfer-hook | `5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV` |

## PDA Derivation

| Account | Seeds |
|---|---|
| Config | `["stablecoin_config", authority, config_id(u64 LE)]` |
| Mint | `["sss_mint", config]` |
| MinterInfo | `["minter_info", config, minter]` |
| RoleAssignment | `["role", config, holder, role_u8]` |
| BlacklistEntry | `["blacklist", config, address]` |
| AllowlistEntry | `["allowlist", config, address]` |
| HookConfig | `["hook_config", mint]` |
| ExtraAccountMetas | `["extra-account-metas", mint]` |

## Instructions (17 total)

### sss-token (15 instructions)

| Instruction | Access | Preset | Description |
|---|---|---|---|
| `initialize` | Authority | All | Create stablecoin config and Token-2022 mint |
| `mint_tokens` | Minter | All | Mint tokens within allowance |
| `burn_tokens` | Burner | All | Burn tokens from own account |
| `freeze_account` | FreezeAuth | All | Freeze a token account |
| `thaw_account` | FreezeAuth | All | Thaw a frozen token account |
| `pause` | Pauser | All | Pause all operations |
| `unpause` | Pauser | All | Resume operations |
| `update_minter` | Authority | All | Set minter allowance and status |
| `assign_role` | Authority | All | Assign role to a wallet |
| `revoke_role` | Authority | All | Revoke role from a wallet |
| `initiate_authority_transfer` | Authority | All | Start two-step transfer |
| `accept_authority` | Pending | All | Accept authority transfer |
| `add_to_blacklist` | Blacklister | SSS-2+ | Blacklist an address |
| `remove_from_blacklist` | Blacklister | SSS-2+ | Remove from blacklist |
| `seize` | Seizer | SSS-2+ | Seize tokens from frozen account |

### sss-transfer-hook (2 instructions)

| Instruction | Description |
|---|---|
| `initialize_hook` | Set up transfer hook with extra account metas |
| `execute` | Blacklist check on every transfer (called by Token-2022) |

## Project Structure

```
sol_stablecoin_standard/
  programs/
    sss-token/              # Main stablecoin program (15 instructions)
      src/
        instructions/       # One file per instruction
        state.rs            # Account structs (Config, MinterInfo, etc.)
        error.rs            # Custom error codes (6000-6049)
        events.rs           # Program events (14 event types)
        constants.rs        # PDA seeds and limits
    sss-transfer-hook/      # Transfer hook program
      src/
        instructions/       # initialize, execute, fallback
        state.rs            # TransferHookConfig
        error.rs            # Hook error codes (7000+)
  modules/
    sss-math/               # Pure Rust math utilities (no_std)
    sss-roles/              # Role enum and helpers
    sss-compliance/         # Preset enum, blacklist/allowlist PDA helpers
    sss-oracle/             # Oracle feed validation
  tests/                    # TypeScript integration tests
  docs/                     # Documentation
```

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design, layer model, data flow |
| [SDK Reference](docs/SDK.md) | TypeScript SDK API documentation |
| [Operations Guide](docs/OPERATIONS.md) | Deployment, monitoring, key management |
| [Deployment Guide](docs/DEPLOYMENT.md) | Step-by-step devnet/mainnet deployment |
| [SSS-1 Specification](docs/SSS-1.md) | Minimal stablecoin preset |
| [SSS-2 Specification](docs/SSS-2.md) | Compliant stablecoin preset |
| [SSS-3 Specification](docs/SSS-3.md) | Private stablecoin preset |
| [Compliance](docs/COMPLIANCE.md) | Blacklisting, seizure, audit trails |
| [API Reference](docs/API.md) | Backend REST API endpoints |
| [Security Model](docs/SECURITY.md) | Threat analysis, access control |
| [Testing Guide](docs/TESTING.md) | Test strategy and execution |
| [Error Reference](docs/ERRORS.md) | All custom error codes |
| [Event Reference](docs/EVENTS.md) | All program events |
| [CLI Reference](docs/CLI.md) | Command-line tool usage |
| [Design Patterns](docs/PATTERNS.md) | PDA derivation, CPI patterns |
| [Oracle Module](docs/ORACLE.md) | Price feed integration and peg monitoring |

## Technology Stack

- **Anchor** 0.32.1 -- Program framework
- **spl-token-2022** 8.0.1 -- Token standard
- **spl-transfer-hook-interface** 0.8.2 -- Transfer hook protocol
- **spl-tlv-account-resolution** 0.8.1 -- Extra account meta resolution
- **spl-token-metadata-interface** 0.5.1 -- On-chain metadata

## License

MIT
