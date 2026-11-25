# FinLedger Architecture

## System Overview

FinLedger separates responsibilities cleanly between a strict-ESM Express/Mongoose API (`server/`) and a pure JavaScript/JSX React 18 SPA (`client/`):

```
Browser (React 18 + Zustand + TanStack Query + Socket.IO Client)
   │  HTTPS / Bearer Access Token (in-memory) + HttpOnly Refresh Cookie + X-CSRF-Token
   ▼
Express API (/api/v1) + Socket.IO Server
   ├── Middleware: Helmet, CORS Allowlist, Compression, Cookie Parser, Pino HTTP, Rate Limiter
   ├── Auth & RBAC: JWT Verify, Double-Submit CSRF, WorkspaceMember Role Matrix
   ├── Domain Services (ACID Transactions via runInTransaction)
   │     ├── Ledger Service (postJournalEntry, reverseJournalEntry, starter accounts)
   │     ├── Transaction & Budget Services (FX snapshots, threshold alerts)
   │     ├── Group Splitter Service (Hamilton distributeAmount, simplifyGroupDebts, settlements)
   │     ├── Invoice & PDFKit Services (bps taxes, partial/full payments, %PDF- streams)
   │     └── Recurring Job (atomic nextRunAt claim lock)
   └── MongoDB (Atlas Replica Set in prod / MongoMemoryReplSet in dev:memory & tests)
```

## Financial Engineering Principles

1. **Integer Minor Units**: `server/src/utils/money.js` and `client/src/lib/money.js` perform all monetary math in safe integers (`Number.isSafeInteger`). FX conversion uses `BigInt` micro-unit scaling (`1_000_000n`) and half-up rounding.
2. **Double-Entry Accounting**:
   - `ASSET` and `EXPENSE` accounts follow debit-normal balance rules (`+DEBIT - CREDIT`).
   - `LIABILITY`, `INCOME`, and `EQUITY` accounts follow credit-normal balance rules (`+CREDIT - DEBIT`).
   - `LedgerService.postJournalEntry` enforces `SUM(DEBIT) === SUM(CREDIT)` inside the active Mongoose `ClientSession`.
3. **Immutable Audit Trail**: Editing or voiding a `Transaction` or voiding an unpaid `Invoice` invokes `reverseJournalEntry` to create a `REVERSAL` journal rather than deleting posted accounting history.
4. **Realtime Synchronization**: Mutations emit workspace-scoped Socket.IO events (`transaction:created`, `group:expense_added`, `group:settled`, `invoice:paid`, `budget:threshold_crossed`, `notification:new`) after transaction commit; the client invalidates relevant TanStack Query caches automatically.
