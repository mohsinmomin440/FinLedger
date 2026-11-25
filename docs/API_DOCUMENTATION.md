# API Documentation (`/api/v1`)

All JSON endpoints return:
- Success: `{ "success": true, "message": "...", "data": ..., "meta": ... }`
- Failure: `{ "success": false, "message": "...", "code": "...", "errors": ... }`

Workspace-scoped routes resolve workspace via `x-workspace-id` header (falling back to `user.activeWorkspace`) and require `Authorization: Bearer <accessToken>`.

## Endpoints

### Health & Auth
- `GET /api/v1/health` — Database connection status and server uptime.
- `GET /api/v1/auth/csrf` — Cross-origin CSRF cookie bootstrap helper for SPAs hosted separately from the API.
- `POST /api/v1/auth/register` — Register user, auto-provision workspace + 8 starter accounts, issue access token & cookies.
- `POST /api/v1/auth/login` — Authenticate and issue tokens.
- `POST /api/v1/auth/refresh` — Rotate refresh cookie (`X-CSRF-Token` required; triggers family revocation on reuse).
- `POST /api/v1/auth/logout` — Revoke current refresh session & clear cookies (`X-CSRF-Token` required).
- `GET /api/v1/auth/me` — Fetch current user and workspace memberships.
- `GET /api/v1/auth/sessions` / `DELETE /api/v1/auth/sessions/:id` — Manage active refresh sessions (`X-CSRF-Token` required).
- `POST /api/v1/auth/forgot-password` / `POST /api/v1/auth/reset-password` / `POST /api/v1/auth/verify-email`

### Workspaces & RBAC
- `GET /api/v1/workspaces`, `POST /api/v1/workspaces`, `POST /api/v1/workspaces/:workspaceId/switch`
- `PATCH /api/v1/workspaces/current` (`ADMIN+`)
- `GET /api/v1/workspaces/members` (`VIEWER+`)
- `POST /api/v1/workspaces/members/invite` (`ADMIN+`)
- `POST /api/v1/workspaces/invitations/accept`
- `PATCH /api/v1/workspaces/members/:memberId`, `DELETE /api/v1/workspaces/members/:memberId` (`ADMIN+`)

### Accounts, Ledger, Transactions & Budgets
- `GET /api/v1/accounts`, `POST /api/v1/accounts` (`ADMIN+`), `PATCH /api/v1/accounts/:id` (`ADMIN+`)
- `GET /api/v1/ledger/journals`, `GET /api/v1/ledger/entries` (`VIEWER+`)
- `GET /api/v1/transactions`, `POST /api/v1/transactions`, `PATCH /api/v1/transactions/:id`, `DELETE /api/v1/transactions/:id`, `GET /api/v1/transactions/export/csv`
- `GET /api/v1/budgets`, `POST /api/v1/budgets`, `DELETE /api/v1/budgets/:id`

### Expense Groups & Settlements
- `GET /api/v1/groups`, `POST /api/v1/groups`
- `GET /api/v1/groups/:id/balances` — Returns members, expenses, settlements, net balances, and `simplifiedDebts`.
- `POST /api/v1/groups/:id/members`
- `POST /api/v1/groups/:id/expenses`, `PATCH /api/v1/groups/:id/expenses/:expenseId`, `DELETE /api/v1/groups/:id/expenses/:expenseId`
- `POST /api/v1/groups/:id/settlements` — Records ACID settlement and double-entry ledger journal.

### Clients, Invoices, Recurring, Receipts, Analytics & Notifications
- `GET/POST /api/v1/clients`, `PATCH/DELETE /api/v1/clients/:id`
- `GET/POST /api/v1/invoices`, `GET/PATCH /api/v1/invoices/:id`, `POST /api/v1/invoices/:id/send`, `POST /api/v1/invoices/:id/void`, `POST /api/v1/invoices/:id/payments`, `GET /api/v1/invoices/:id/pdf`
- `GET/POST /api/v1/recurring`, `PATCH/DELETE /api/v1/recurring/:id`, `POST /api/v1/recurring/:id/trigger`
- `GET/POST /api/v1/receipts`, `GET /api/v1/receipts/:id/file`, `DELETE /api/v1/receipts/:id`
- `GET /api/v1/analytics/overview`, `GET /api/v1/analytics/export/csv`, `GET /api/v1/analytics/statement/pdf`
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`
