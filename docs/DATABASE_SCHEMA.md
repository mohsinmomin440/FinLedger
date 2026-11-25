# Database Schema (`server/src/models/`)

All workspace-owned collections store a `workspace` (`ObjectId` ref `Workspace`) field and compound indexes starting with `workspace`.

## Identity & Tenancy
- **User**: `name`, `email` (unique), `passwordHash` (`select: false`), `defaultCurrency`, `emailVerified`, verification/reset token hashes + expirations, `activeWorkspace`.
- **RefreshToken**: `user`, `tokenHash` (SHA-256, unique), `familyId`, `expiresAt`, `revokedAt`, `replacedByTokenHash`, `userAgent`, `ipAddress`.
- **Workspace**: `name`, `slug` (unique), `type` (`PERSONAL | BUSINESS`), `baseCurrency`, `owner`.
- **WorkspaceMember**: `workspace`, `user`, `role` (`OWNER | ADMIN | MEMBER | VIEWER`), unique `(workspace, user)`.
- **Invitation**: `workspace`, `email`, `role`, `tokenHash`, `expiresAt`, `status`, `invitedBy`.

## Double-Entry Ledger & Personal Finance
- **Account**: `workspace`, `name`, `type` (`ASSET | LIABILITY | INCOME | EXPENSE | EQUITY`), `subtype` (`CASH | BANK | CARD | RECEIVABLE | PAYABLE | OPERATING | EQUITY`), `currency`, `balanceMinor` (integer), `archived`, `isSystem`.
- **LedgerJournal**: `workspace`, `referenceType`, `referenceId`, `description`, `date`, `status` (`POSTED | REVERSED`), `reversesJournalId`, `reversedByJournalId`, `currency`, `totalMinor`, `entries[]` (`account`, `side`, `amountMinor`).
- **LedgerEntry**: `workspace`, `journal`, `account`, `side` (`DEBIT | CREDIT`), `amountMinor`, `currency`, `date`.
- **Transaction**: `workspace`, `type` (`INCOME | EXPENSE | TRANSFER`), `account`, `toAccount`, `category`, `description`, `originalAmountMinor`, `originalCurrency`, `exchangeRate`, `rateSource`, `baseAmountMinor`, `occurredAt`, `recurringRuleId`, `receiptIds`, `ledgerJournalId`, `status` (`POSTED | VOIDED`).
- **Budget**: `workspace`, `category`, `monthKey` (`YYYY-MM`), `limitMinor`, `alertThresholdPercent`, `lastAlertLevel`.

## Expense Splitting
- **ExpenseGroup**: `workspace`, `name`, `description`, `currency`, `members[]` (`_id`, `userId`, `name`, `email`).
- **GroupExpense**: `workspace`, `group`, `title`, `notes`, `paidByMemberId`, `originalAmountMinor`, `originalCurrency`, `exchangeRate`, `rateSource`, `baseAmountMinor`, `splitType` (`EQUAL | EXACT | PERCENTAGE | SHARES`), `splits[]` (`memberId`, `shareValue`, `owedMinor`), `occurredAt`, `receiptIds`, `isSettled`.
- **Settlement**: `workspace`, `group`, `fromMemberId`, `toMemberId`, `amountMinor`, `currency`, `exchangeRate`, `baseAmountMinor`, `note`, `settledAt`, `ledgerJournalId`.

## Invoicing, Automation, Receipts & Audit
- **Client**: `workspace`, `name`, `email`, `phone`, `company`, `billingAddress`, `taxId`, `defaultCurrency`.
- **Invoice**: `workspace`, `client`, `invoiceNumber`, `status` (`DRAFT | SENT | PARTIAL | PAID | OVERDUE | VOID`), `issueDate`, `dueDate`, `currency`, `exchangeRate`, `lineItems[]` (`description`, `qty`, `unitPriceMinor`, `taxRateBps`, `lineTotalMinor`), `subtotalMinor`, `taxMinor`, `discountMinor`, `totalMinor`, `baseTotalMinor`, `paidMinor`, `payments[]`, `accrualJournalId`, `recurringRuleId`.
- **RecurringRule**: `workspace`, `name`, `kind` (`TRANSACTION | INVOICE`), `frequency` (`WEEKLY | MONTHLY | YEARLY`), `nextRunAt`, `lastRunAt`, `isActive`, `templatePayload`.
- **Receipt**: `workspace`, `uploadedBy`, `entityType`, `entityId`, `originalName`, `mimeType`, `sizeBytes`, `storageKey`.
- **Notification** & **Activity**: `workspace`, `user`/`actor`, `type`, `title`, `message`, `readAt`, `metadata`.
