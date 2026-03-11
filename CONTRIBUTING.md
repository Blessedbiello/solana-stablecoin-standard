# Contributing to Solana Stablecoin Standard

Thank you for your interest in contributing to the Solana Stablecoin Standard. This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32.1
- Node.js 18+
- Yarn 1.22+

### Build

```bash
git clone https://github.com/solanabr/solana-stablecoin-standard.git
cd solana-stablecoin-standard
yarn install
anchor build
```

### Test

```bash
# On-chain integration tests
anchor test

# Rust module tests
cargo test -p sss-math
cargo test -p sss-roles
cargo test -p sss-compliance

# SDK unit tests
cd sdk/core && yarn test

# Fuzz tests (requires Trident)
trident fuzz run fuzz_0
```

## Project Structure

```
programs/          # Anchor programs (sss-token, sss-transfer-hook)
modules/           # Shared Rust crates (sss-math, sss-roles, sss-compliance, sss-oracle)
sdk/core/          # TypeScript SDK and CLI
backend/           # REST API, event listener, webhook worker
tests/             # Anchor integration tests
trident-tests/     # Fuzz test harnesses
docs/              # Documentation
```

## Coding Standards

### Rust

- Follow standard Rust formatting (`cargo fmt`)
- All public items must have doc comments
- Use `checked_*` arithmetic or return `SssError::Overflow`
- PDA seeds must match the constants in `constants.rs`
- Every instruction follows the 7-step pattern: validate, read, calculate, check, execute, update, emit

### TypeScript

- Use TypeScript strict mode
- Export all public types from `src/index.ts`
- PDA derivation functions go in `src/pda.ts`
- Use `BN` for all on-chain numeric values

### Tests

- Integration tests go in `tests/` (Anchor/Mocha)
- SDK unit tests go in `sdk/core/tests/` (Mocha/Chai)
- Each test file should focus on a single feature or concern
- Test both success paths and error paths

## Branching Strategy

- `main` -- stable, deployable code
- `feat/<name>` -- new features
- `fix/<name>` -- bug fixes
- `docs/<name>` -- documentation changes

## Commit Messages

Use conventional commits:

```
feat(programs): add confidential transfer support
fix(sdk): correct PDA derivation for allowlist
test: add edge case tests for seize instruction
docs: update deployment guide for mainnet
chore: bump anchor to 0.32.2
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure `anchor build` and `anchor test` pass
4. Ensure `cargo fmt` and `cargo clippy` produce no warnings
5. Update relevant documentation
6. Submit a PR with a clear description of changes

## Security

If you discover a security vulnerability, please report it privately rather than opening a public issue. Contact the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
