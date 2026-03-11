# Solana Stablecoin Standard -- Documentation Index

## Overview

This directory contains the complete documentation for the Solana Stablecoin Standard (SSS) project. The documentation is organized by audience and topic.

## Getting Started

If you are new to the project, read these documents in order:

1. [Architecture](ARCHITECTURE.md) -- Understand the system design
2. [SSS-1 Specification](SSS-1.md) -- Start with the minimal preset
3. [Deployment Guide](DEPLOYMENT.md) -- Deploy your first stablecoin
4. [SDK Reference](SDK.md) -- Integrate with TypeScript

## Reference Documents

### Specifications

| Document | Description |
|---|---|
| [SSS-1 Specification](SSS-1.md) | Minimal stablecoin -- mint, burn, freeze, pause, roles |
| [SSS-2 Specification](SSS-2.md) | Compliant stablecoin -- blacklists, seizure, transfer hooks |
| [SSS-3 Specification](SSS-3.md) | Private stablecoin -- confidential transfers, allowlists |

### Architecture and Design

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | System layers, data flow, account model |
| [Design Patterns](PATTERNS.md) | PDA derivation, CPI, instruction patterns |
| [Security Model](SECURITY.md) | Threat analysis, RBAC, access control |

### Development

| Document | Description |
|---|---|
| [SDK Reference](SDK.md) | TypeScript SDK API (`@stbr/sss-token`) |
| [CLI Reference](CLI.md) | Command-line tool usage and examples |
| [API Reference](API.md) | Backend REST API endpoints |
| [Testing Guide](TESTING.md) | Test strategy, categories, execution |

### Operations

| Document | Description |
|---|---|
| [Deployment Guide](DEPLOYMENT.md) | Step-by-step devnet and mainnet deployment |
| [Operations Guide](OPERATIONS.md) | Monitoring, key management, runbooks |
| [Compliance](COMPLIANCE.md) | Blacklisting, seizure flow, audit trails |

### Modules

| Document | Description |
|---|---|
| [Oracle Module](ORACLE.md) | Price feed integration and peg monitoring |

### Reference

| Document | Description |
|---|---|
| [Error Codes](ERRORS.md) | All custom error codes from both programs |
| [Events](EVENTS.md) | All program events with field descriptions |

## Document Map by Role

### Stablecoin Issuer

Start with: [SSS-1](SSS-1.md) or [SSS-2](SSS-2.md) -> [Deployment](DEPLOYMENT.md) -> [Operations](OPERATIONS.md)

### Developer / Integrator

Start with: [Architecture](ARCHITECTURE.md) -> [SDK](SDK.md) -> [Patterns](PATTERNS.md) -> [Errors](ERRORS.md)

### Compliance Officer

Start with: [SSS-2](SSS-2.md) -> [Compliance](COMPLIANCE.md) -> [Events](EVENTS.md) -> [Security](SECURITY.md)

### DevOps / SRE

Start with: [Deployment](DEPLOYMENT.md) -> [Operations](OPERATIONS.md) -> [Security](SECURITY.md) -> [API](API.md)
