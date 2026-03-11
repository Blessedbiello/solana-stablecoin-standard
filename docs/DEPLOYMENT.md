# Deployment Guide

## Prerequisites

| Tool | Version | Installation |
|---|---|---|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` |
| Anchor | 0.32.1 | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.32.1 && avm use 0.32.1` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Yarn | 1.x | `npm install -g yarn` |

## Build

```bash
# Install JS dependencies
yarn install

# Build both programs
anchor build

# Verify build artifacts
ls target/deploy/
# Expected: sss_token.so, sss_transfer_hook.so
```

## Devnet Deployment

### Step 1: Configure Solana CLI

```bash
solana config set --url devnet
solana config get
# Verify: RPC URL = https://api.devnet.solana.com
```

### Step 2: Generate Deployer Keypair

```bash
mkdir -p keypairs

# Generate deployer keypair (or use existing)
solana-keygen new -o keypairs/deployer.json --no-bip39-passphrase

# Fund the deployer
solana airdrop 5 keypairs/deployer.json --url devnet
solana airdrop 5 keypairs/deployer.json --url devnet
# Request multiple airdrops if needed (devnet limit is 2 SOL per request)
```

### Step 3: Deploy Programs

```bash
# Deploy both programs
anchor deploy --provider.cluster devnet --provider.wallet keypairs/deployer.json

# Verify deployment
solana program show VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB --url devnet
solana program show 5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV --url devnet
```

### Devnet Deployment Proof

Both programs have been deployed to Solana devnet with the following transactions:

| Program | Program ID | Deploy Signature |
|---|---|---|
| sss-token | `VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB` | `Wa3K4ze7T1LcdzWogLNepHTwq5JmEFRxPtpwfL1DeAnpQMpKU9PDbWnon4jVgjygQXR7HjaCVXRdMYCzETNpUoj` |
| sss-transfer-hook | `5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV` | `33eo9fzDCPaaUtrXUBbXccUBAUM8jC5aQWLtPyTamgHdvBWEjTJcdeiZE82yhuv6i8UMzwyFAh3omwBoPbnEjRp2` |

**Deployer**: `9ZW3vicGdW2N4Dgn1vgrznqZwYqwnyLupimTLdK5Ktez`
**IDL Accounts**: `AyLomk8sMcAQMNytE9YSoQ3JJu5gMY8fC57XLH2H35YQ` (sss-token), `6RxrgZzMYhC5gyUSMQhHBdJTZKUoLkWUTngVaX2hztAx` (sss-transfer-hook)

Verify on Solana Explorer:
- [sss-token on devnet](https://explorer.solana.com/address/VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB?cluster=devnet)
- [sss-transfer-hook on devnet](https://explorer.solana.com/address/5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV?cluster=devnet)

### Step 4: Initialize Stablecoin

```bash
# Generate authority keypair
solana-keygen new -o keypairs/authority.json --no-bip39-passphrase
solana airdrop 2 keypairs/authority.json --url devnet

# Initialize SSS-1 (Minimal)
sss-token initialize \
  --preset 1 \
  --config-id 0 \
  --decimals 6 \
  --name "Test USD" \
  --symbol "TUSD" \
  --uri "https://example.com/metadata.json" \
  --keypair keypairs/authority.json \
  --url devnet

# Initialize SSS-2 (Compliant) -- requires transfer hook program
sss-token initialize \
  --preset 2 \
  --config-id 0 \
  --decimals 6 \
  --name "Compliant USD" \
  --symbol "CUSD" \
  --uri "https://example.com/metadata.json" \
  --transfer-hook-program 5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV \
  --keypair keypairs/authority.json \
  --url devnet
```

### Step 5: Initialize Transfer Hook (SSS-2+)

For SSS-2 and SSS-3 presets, the transfer hook must be initialized separately:

```bash
sss-token hook initialize \
  --config <CONFIG_PUBKEY> \
  --mint <MINT_PUBKEY> \
  --keypair keypairs/authority.json \
  --url devnet
```

### Step 6: Set Up Roles

```bash
# Generate role keypairs
solana-keygen new -o keypairs/minter.json --no-bip39-passphrase
solana-keygen new -o keypairs/burner.json --no-bip39-passphrase
solana-keygen new -o keypairs/pauser.json --no-bip39-passphrase
solana-keygen new -o keypairs/freezer.json --no-bip39-passphrase

# Assign roles
sss-token role assign --config <CONFIG> --holder $(solana-keygen pubkey keypairs/minter.json) --role minter --keypair keypairs/authority.json --url devnet
sss-token role assign --config <CONFIG> --holder $(solana-keygen pubkey keypairs/burner.json) --role burner --keypair keypairs/authority.json --url devnet
sss-token role assign --config <CONFIG> --holder $(solana-keygen pubkey keypairs/pauser.json) --role pauser --keypair keypairs/authority.json --url devnet
sss-token role assign --config <CONFIG> --holder $(solana-keygen pubkey keypairs/freezer.json) --role freeze-auth --keypair keypairs/authority.json --url devnet

# Configure minter allowance (1M tokens with 6 decimals)
sss-token minter update \
  --config <CONFIG> \
  --minter $(solana-keygen pubkey keypairs/minter.json) \
  --allowance 1000000000000 \
  --active true \
  --keypair keypairs/authority.json \
  --url devnet
```

### Step 7: Verify Deployment

```bash
# Check config
sss-token view config --config <CONFIG_PUBKEY> --url devnet

# Test mint
sss-token mint \
  --config <CONFIG> \
  --recipient <RECIPIENT_TOKEN_ACCOUNT> \
  --amount 1000000 \
  --keypair keypairs/minter.json \
  --url devnet

# Check supply
sss-token view config --config <CONFIG> --url devnet
```

## Mainnet Deployment

### Pre-Deployment Checklist

- [ ] All integration tests pass on devnet
- [ ] Security audit completed (if applicable)
- [ ] Authority keypair generated on air-gapped machine or HSM
- [ ] Pauser keypair ready and accessible for emergencies
- [ ] Treasury token account created and verified
- [ ] Program binaries verified (compare hashes with build output)
- [ ] Deployment SOL funded (estimate: 5-10 SOL for both programs + accounts)
- [ ] Monitoring and alerting configured
- [ ] Incident response runbook reviewed
- [ ] Role keypairs generated and securely stored

### Step 1: Build and Verify

```bash
# Clean build
anchor build

# Record program hashes
sha256sum target/deploy/sss_token.so
sha256sum target/deploy/sss_transfer_hook.so
```

### Step 2: Deploy to Mainnet

```bash
solana config set --url mainnet-beta

# Deploy (requires sufficient SOL for program rent)
anchor deploy \
  --provider.cluster mainnet \
  --provider.wallet keypairs/deployer.json

# Verify deployment
solana program show VuhEhakwgobFN7L3fJJJCu4HTrV1mahAt8MUxiPnxwB
solana program show 5ADnkQpQx8NZwy8xXSqQW9jbahsQLgQBpTHqpbRTSYgV
```

### Step 3: Lock Program Upgrade Authority (Optional)

For production deployments, consider transferring or revoking the program upgrade authority:

```bash
# Transfer to a multisig
solana program set-upgrade-authority <PROGRAM_ID> \
  --new-upgrade-authority <MULTISIG_ADDRESS> \
  --keypair keypairs/deployer.json

# Or make immutable (irreversible)
solana program set-upgrade-authority <PROGRAM_ID> \
  --final \
  --keypair keypairs/deployer.json
```

### Step 4: Initialize and Configure

Follow the same initialization steps as devnet, replacing `--url devnet` with `--url mainnet-beta`.

### Post-Deployment Verification

1. Fetch and verify config state matches expectations
2. Test a small mint operation
3. Verify mint shows up in block explorer (Solscan, Solana FM)
4. Confirm event monitoring is receiving events
5. Test pause/unpause cycle
6. For SSS-2: test blacklist add/remove and verify transfer blocking

## Multiple Deployments

The `config_id` parameter allows deploying multiple stablecoins from the same authority:

```bash
# Deploy USDS (config_id = 0)
sss-token initialize --config-id 0 --name "US Dollar Stablecoin" --symbol "USDS" ...

# Deploy EURS (config_id = 1)
sss-token initialize --config-id 1 --name "Euro Stablecoin" --symbol "EURS" ...

# Deploy GBPS (config_id = 2)
sss-token initialize --config-id 2 --name "British Pound Stablecoin" --symbol "GBPS" ...
```

Each deployment gets its own config PDA, mint PDA, and independent role/minter set.

## Troubleshooting

### Common Deployment Issues

| Issue | Cause | Solution |
|---|---|---|
| `Insufficient funds` | Not enough SOL for rent | Fund deployer with more SOL |
| `Account already in use` | Program ID already deployed | Use a different keypair or upgrade |
| `Transaction too large` | Too many accounts in single tx | Split initialization steps |
| `RPC rate limit` | Too many requests | Use a dedicated RPC endpoint |
| `Program deploy failed` | Binary too large or corrupt | Rebuild with `anchor build` |

### Verifying PDA Addresses

```typescript
import { findConfigPda, findMintPda } from "@stbr/sss-token";

const [config] = findConfigPda(programId, authority, configId);
const [mint] = findMintPda(programId, config);

console.log("Config PDA:", config.toBase58());
console.log("Mint PDA:", mint.toBase58());
```
