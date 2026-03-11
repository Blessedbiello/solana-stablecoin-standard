# Changelog

All notable changes to the Solana Stablecoin Standard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-03-11

### Added

- **sss-token program** with 15 instructions: initialize, mint, burn, freeze, thaw, pause, unpause, update_minter, assign_role, revoke_role, initiate_authority_transfer, accept_authority, add_to_blacklist, remove_from_blacklist, seize
- **sss-transfer-hook program** with blacklist enforcement on every `transfer_checked` call via Token-2022 TransferHook extension
- **Three preset levels**: SSS-1 (Minimal), SSS-2 (Compliant), SSS-3 (Private)
- **RBAC with 6 roles**: Minter, Burner, Blacklister, Pauser, Seizer, FreezeAuth
- **Token-2022 extensions**: MetadataPointer (all presets), PermanentDelegate (SSS-2+), TransferHook (SSS-2+)
- **Two-step authority transfer** with initiate/accept pattern
- **Minter allowance system** with per-minter caps and on-chain tracking
- **Shared modules**: sss-math (pure Rust arithmetic), sss-roles (role definitions), sss-compliance (preset/blacklist helpers), sss-oracle (feed validation)
- **TypeScript SDK** (`@stbr/sss-token`) with SolanaStablecoin class, ComplianceModule, PDA helpers, and preset utilities
- **CLI tool** (`sss-token`) with commands for all program operations
- **Backend services**: REST API, event listener, webhook worker with Docker Compose
- **Integration tests**: SSS-1, SSS-2, transfer hook, roles, edge cases, multi-user scenarios
- **SDK unit tests**: PDA derivation, presets, types, compliance module
- **Trident fuzz tests**: 3 harnesses covering core, compliance, and role invariants
- **Documentation**: Architecture, SDK reference, CLI reference, API reference, deployment guide, operations guide, security model, compliance guide, testing guide, error codes, events, design patterns, preset specifications (SSS-1, SSS-2, SSS-3)

### Program IDs

| Program | Localnet ID |
|---|---|
| sss-token | `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB` |
| sss-transfer-hook | `5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV` |
