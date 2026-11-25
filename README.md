# FinLedger

**FinLedger** is a full-stack **Expense Splitting, Invoicing & Personal Finance Platform** (a Splitwise + Wave hybrid) built on the MERN stack with strict integer minor-unit arithmetic, double-entry accounting inside MongoDB ACID transactions, deterministic debt simplification, and server-side PDFKit statement/invoice generation.

## Quick Start (Zero-Config In-Memory Mode)

```bash
npm run install:all
npm run dev:memory
```

`npm run dev:memory` launches:
- **API Server**: `http://localhost:5000` backed by `MongoMemoryReplSet` (supports real MongoDB multi-document ACID transactions with zero external DB setup and auto-generated ephemeral dev JWT secrets).
- **Web App**: `http://localhost:5173` (Vite React 18 SPA proxying `/api` and `/socket.io` to the API).

## Core Engineering Guarantees

- **Integer Minor Units Only**: All money amounts are stored and computed in integer minor units (e.g., `1050` = `₹10.50` / `$10.50`) with `BigInt`-scaled FX conversion and basis-point (`bps`) invoice tax calculation.
- **Hamilton / Largest Remainder Splits**: `distributeAmount(totalMinor, weightsOrCount)` guarantees equal, exact, percentage, and share splits always sum identically to `totalMinor`.
- **Double-Entry Ledger & Reversals**: Every personal transaction, transfer, invoice accrual/payment, and group settlement creates a balanced `LedgerJournal` + `LedgerEntry` set (`SUM(debits) === SUM(credits)`). Edits and voids post immutable reversing journals instead of mutating history.
- **Minimum Cash-Flow Debt Simplification**: `simplifyGroupDebts(memberBalances)` verifies zero-sum balances and produces minimal settlement transfers.
- **Multi-Tenant Isolation & Security**: In-memory access tokens (never `localStorage`), hashed `RefreshToken` family rotation with reuse detection, double-submit CSRF protection, workspace RBAC (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), private magic-byte-verified receipt uploads, and formula-safe CSV exports.

## Scripts

| Command | Description |
| --- | --- |
| `npm run install:all` | Install root, server, and client dependencies |
| `npm run dev:memory` | Start API (`MongoMemoryReplSet`) and Vite frontend |
| `npm run dev` | Start API (using `MONGO_URI` / `.env`) and Vite frontend |
| `npm run build` | Build production React bundle (`client/dist`) |
| `npm run start` | Run production Express API server |
| `npm run test` | Run backend and frontend Vitest suites |
| `npm run test:server` | Run backend Vitest unit & Supertest integration tests |
| `npm run test:client` | Run frontend Vitest + React Testing Library tests |
| `npm run test:e2e` | Run Playwright full-stack browser E2E suite |
| `npm run lint` | Run ESLint across server, client, and E2E |
| `npm run format` | Run Prettier across repository |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
