# Backend API Reference

## Overview

The SSS backend service provides a REST API for managing stablecoin operations, querying state, and integrating with external systems. It wraps the on-chain programs with authentication, rate limiting, and convenience endpoints.

## Base URL

```
Production:  https://api.sss.example.com/v1
Staging:     https://api-staging.sss.example.com/v1
```

## Authentication

All endpoints require a Bearer token:

```
Authorization: Bearer <API_KEY>
```

API keys are scoped to specific operations:
- `admin` -- Full access
- `minter` -- Mint and view operations
- `compliance` -- Blacklist, freeze, seize, and view operations
- `readonly` -- View operations only

## Endpoints

### Stablecoin Management

#### `POST /stablecoin/initialize`

Initialize a new stablecoin deployment.

**Request:**
```json
{
  "preset": 2,
  "configId": 0,
  "decimals": 6,
  "name": "USD Stablecoin",
  "symbol": "USDS",
  "uri": "https://example.com/metadata.json",
  "treasury": "TreasuryPublicKey..."
}
```

**Response:**
```json
{
  "config": "ConfigPublicKey...",
  "mint": "MintPublicKey...",
  "signature": "TxSignature...",
  "slot": 123456789
}
```

#### `GET /stablecoin/:config`

Fetch stablecoin configuration.

**Response:**
```json
{
  "config": "ConfigPublicKey...",
  "masterAuthority": "AuthorityPublicKey...",
  "mint": "MintPublicKey...",
  "treasury": "TreasuryPublicKey...",
  "preset": 2,
  "decimals": 6,
  "paused": false,
  "totalMinted": "1000000000000",
  "totalBurned": "50000000000",
  "currentSupply": "950000000000",
  "transferHookProgram": "HookProgramId..."
}
```

#### `GET /stablecoin/:config/supply`

Get current supply metrics.

**Response:**
```json
{
  "totalMinted": "1000000000000",
  "totalBurned": "50000000000",
  "currentSupply": "950000000000",
  "decimals": 6,
  "formattedSupply": "950000.000000"
}
```

### Token Operations

#### `POST /stablecoin/:config/mint`

Mint tokens to a recipient.

**Request:**
```json
{
  "recipient": "RecipientPublicKey...",
  "amount": "1000000000"
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "amount": "1000000000",
  "recipient": "RecipientPublicKey...",
  "minterAllowanceRemaining": "999000000000",
  "newTotalMinted": "1001000000000"
}
```

#### `POST /stablecoin/:config/burn`

Burn tokens.

**Request:**
```json
{
  "amount": "500000000"
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "amount": "500000000",
  "newTotalBurned": "50500000000"
}
```

### Account Management

#### `POST /stablecoin/:config/freeze`

Freeze a token account.

**Request:**
```json
{
  "tokenAccount": "TokenAccountPublicKey..."
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "tokenAccount": "TokenAccountPublicKey...",
  "frozen": true
}
```

#### `POST /stablecoin/:config/thaw`

Thaw a frozen token account.

**Request:**
```json
{
  "tokenAccount": "TokenAccountPublicKey..."
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "tokenAccount": "TokenAccountPublicKey...",
  "frozen": false
}
```

### Pause Control

#### `POST /stablecoin/:config/pause`

Pause all operations.

**Response:**
```json
{
  "signature": "TxSignature...",
  "paused": true
}
```

#### `POST /stablecoin/:config/unpause`

Resume operations.

**Response:**
```json
{
  "signature": "TxSignature...",
  "paused": false
}
```

### Role Management

#### `GET /stablecoin/:config/roles`

List all role assignments.

**Response:**
```json
{
  "roles": [
    {
      "holder": "HolderPublicKey...",
      "role": "Minter",
      "roleId": 0,
      "assignedBy": "AuthorityPublicKey...",
      "assignedAt": "2024-01-15T10:30:00Z",
      "pda": "RolePdaPublicKey..."
    }
  ]
}
```

#### `POST /stablecoin/:config/roles/assign`

Assign a role to a wallet.

**Request:**
```json
{
  "holder": "HolderPublicKey...",
  "role": "minter"
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "holder": "HolderPublicKey...",
  "role": "Minter",
  "roleAssignment": "RolePdaPublicKey..."
}
```

#### `POST /stablecoin/:config/roles/revoke`

Revoke a role.

**Request:**
```json
{
  "holder": "HolderPublicKey...",
  "role": "minter"
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "holder": "HolderPublicKey...",
  "role": "Minter",
  "revoked": true
}
```

### Minter Management

#### `GET /stablecoin/:config/minters`

List all minters with their allowances.

**Response:**
```json
{
  "minters": [
    {
      "minter": "MinterPublicKey...",
      "allowance": "1000000000000",
      "totalMinted": "500000000000",
      "remaining": "500000000000",
      "active": true,
      "pda": "MinterPdaPublicKey..."
    }
  ]
}
```

#### `POST /stablecoin/:config/minters/update`

Update minter configuration.

**Request:**
```json
{
  "minter": "MinterPublicKey...",
  "allowance": "2000000000000",
  "active": true
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "minter": "MinterPublicKey...",
  "allowance": "2000000000000",
  "active": true
}
```

### Compliance (SSS-2+)

#### `GET /stablecoin/:config/blacklist`

List all blacklisted addresses.

**Response:**
```json
{
  "entries": [
    {
      "address": "BlacklistedPublicKey...",
      "blacklistedBy": "BlacklisterPublicKey...",
      "reasonHash": "abc123...",
      "createdAt": "2024-01-15T10:30:00Z",
      "pda": "BlacklistPdaPublicKey..."
    }
  ]
}
```

#### `GET /stablecoin/:config/blacklist/:address`

Check if a specific address is blacklisted.

**Response:**
```json
{
  "address": "AddressPublicKey...",
  "blacklisted": true,
  "entry": {
    "blacklistedBy": "BlacklisterPublicKey...",
    "reasonHash": "abc123...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### `POST /stablecoin/:config/blacklist/add`

Add an address to the blacklist.

**Request:**
```json
{
  "address": "TargetPublicKey...",
  "reason": "OFAC SDN List - Entity XYZ"
}
```

The `reason` is hashed (SHA-256) server-side before being sent on-chain.

**Response:**
```json
{
  "signature": "TxSignature...",
  "address": "TargetPublicKey...",
  "reasonHash": "abc123...",
  "blacklistEntry": "BlacklistPdaPublicKey..."
}
```

#### `POST /stablecoin/:config/blacklist/remove`

Remove an address from the blacklist.

**Request:**
```json
{
  "address": "TargetPublicKey..."
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "address": "TargetPublicKey...",
  "removed": true
}
```

#### `POST /stablecoin/:config/seize`

Seize tokens from a frozen account.

**Request:**
```json
{
  "sourceTokenAccount": "SourceTokenAccountPublicKey...",
  "amount": "1000000000"
}
```

**Response:**
```json
{
  "signature": "TxSignature...",
  "from": "SourceTokenAccountPublicKey...",
  "toTreasury": "TreasuryPublicKey...",
  "amount": "1000000000"
}
```

### Events and Audit

#### `GET /stablecoin/:config/events`

Fetch historical events.

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | string | all | Event type filter |
| `from` | ISO 8601 | -- | Start time |
| `to` | ISO 8601 | -- | End time |
| `limit` | number | 100 | Max results |
| `offset` | number | 0 | Pagination offset |

**Response:**
```json
{
  "events": [
    {
      "type": "TokensMinted",
      "data": {
        "config": "ConfigPublicKey...",
        "minter": "MinterPublicKey...",
        "recipient": "RecipientPublicKey...",
        "amount": "1000000000"
      },
      "signature": "TxSignature...",
      "blockTime": 1705312200,
      "slot": 123456789
    }
  ],
  "total": 42,
  "hasMore": false
}
```

### Health

#### `GET /health`

Service health check.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "solanaRpc": "connected",
  "latestSlot": 123456789
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "BLACKLISTED",
    "message": "Address is blacklisted",
    "programError": 6020,
    "details": {
      "address": "TargetPublicKey..."
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Invalid request parameters |
| 401 | Missing or invalid API key |
| 403 | Insufficient permissions for this operation |
| 404 | Resource not found |
| 409 | Conflict (e.g., already blacklisted) |
| 422 | On-chain transaction failed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Rate Limits

| Scope | Limit |
|---|---|
| Read operations | 100 requests/minute |
| Write operations | 20 requests/minute |
| Batch operations | 5 requests/minute |

## Webhooks

Configure webhooks to receive real-time event notifications:

```json
POST /webhooks
{
  "url": "https://your-service.com/webhook",
  "events": ["TokensMinted", "AddressBlacklisted", "TokensSeized"],
  "secret": "your-webhook-secret"
}
```

Webhook payloads are signed with HMAC-SHA256 using the provided secret in the `X-Webhook-Signature` header.
