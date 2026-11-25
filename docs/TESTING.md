# Testing Guide

## Backend Unit & Integration Tests (`npm run test:server`)
Runs Vitest + Supertest against `MongoMemoryReplSet` (real multi-document ACID transactions):
- `server/tests/unit/money.test.js` — Hamilton Largest Remainder distribution, integer FX conversions, basis-point tax, production env fail-fast.
- `server/tests/unit/debtSimplifier.test.js` — Minimum cash-flow transfers and zero-sum invariant enforcement.
- `server/tests/unit/csv.test.js` — Spreadsheet formula-injection neutralization.
- `server/tests/integration/auth.test.js` — Registration, starter accounts, CSRF enforcement, refresh token rotation + reuse family revocation, email verification, password reset.
- `server/tests/integration/tenancyRbac.test.js` — Cross-workspace isolation (`403`/`404`) and `OWNER`/`ADMIN`/`MEMBER`/`VIEWER` RBAC matrix.
- `server/tests/integration/ledgerTransactions.test.js` — Balanced double-entry postings (`SUM(debits) === SUM(credits)`), FX snapshots, reversing entries on edit and void.
- `server/tests/integration/groupsSettlements.test.js` — Equal/Exact/Percentage/Shares splits, debt simplification, ACID settlements.
- `server/tests/integration/invoicesPdf.test.js` — `DRAFT -> SENT -> PARTIAL -> PAID` lifecycle, ledger AR reconciliation, valid `%PDF-` stream.
- `server/tests/integration/analyticsRecurring.test.js` — Budget threshold alerts, CSV export, monthly PDF statement, recurring rule idempotency lock.
- `server/tests/integration/receiptsUpload.test.js` — Valid upload/download, cross-tenant rejection, SVG/magic-byte spoofing rejection.
- `server/tests/integration/sockets.test.js` — Socket.IO JWT handshake, room membership authorization, live event delivery.

## Frontend Component Tests (`npm run test:client`)
Runs Vitest + React Testing Library + jsdom:
- `client/src/tests/authFlow.test.jsx` — Protected route redirects, memory-only token storage, registration payload.
- `client/src/tests/splitExpenseForm.test.jsx` — Live penny-exact `EQUAL`, `EXACT`, and `PERCENTAGE` split previews.
- `client/src/tests/dashboardAndViews.test.jsx` — Dashboard KPIs & error retry, Transactions empty state, Invoice builder integer totals.

## End-to-End Browser Tests (`npm run test:e2e`)
Runs Playwright Chromium against live Express (`USE_MEMORY_DB=true`) and Vite (`e2e/finledger.spec.js`), executing registration, personal expense posting, group splitting, debt simplification, 1-click settlement, client & invoice creation, payment recording, PDF download verification, analytics reload persistence, and logout.
