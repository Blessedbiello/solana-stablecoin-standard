# Solana Stablecoin Standard — Implementation Tracker

## Phase Status

| Phase | Status | Commit |
|-------|--------|--------|
| 1. Foundation | DONE | `feat: scaffold project with workspace, modules, and Anchor config` |
| 2. Core Program | DONE | `feat(programs): implement sss-token core instructions with RBAC` |
| 3. Transfer Hook | DONE | `feat(programs): add transfer hook program for blacklist enforcement` |
| 4. Integration Tests | DONE | `test: add integration tests for SSS-1, SSS-2, roles, and edge cases` |
| 5. TypeScript SDK | DONE | `feat(sdk): implement TypeScript SDK with presets and compliance module` |
| 6. CLI | DONE | `feat(cli): add sss-token admin CLI with all commands` |
| 7. Backend | DONE | `feat(backend): add Docker-containerized API, indexer, and webhook services` |
| 8. Bonus Features | DONE | `feat(bonus): add SSS-3 privacy SDK, admin TUI, and Next.js frontend` |
| 9. Polish & Docs | DONE | `docs: add complete documentation suite with 17 reference documents` |
| 10. Devnet Deploy | DONE | `chore: devnet deployment with proof transactions` |

## Architecture

- **sss-token**: Main stablecoin program (15 instructions, RBAC, Token-2022)
- **sss-transfer-hook**: Blacklist enforcement via transfer hooks
- **Modules**: sss-math (pure Rust), sss-roles, sss-compliance, sss-oracle
- **Presets**: SSS-1 (Minimal), SSS-2 (Compliant), SSS-3 (Private)

## Key Decisions

- Anchor 0.32.1, spl-token-2022 8.0.1
- Config PDA: `["stablecoin_config", authority, config_id(u64 LE)]`
- Mint PDA: `["sss_mint", config]` — Token-2022 owned
- Role PDA: `["role", config, holder, role_u8]`
- Blacklist PDA: `["blacklist", config, address]`
- Minter PDA: `["minter_info", config, minter]`

## Build & Test

```bash
anchor build         # Both programs
cargo test -p sss-math  # Module tests
anchor test          # Integration tests (Phase 4)
```
