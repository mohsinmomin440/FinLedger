import { Account, LedgerEntry, LedgerJournal } from '../models/index.js';
import { sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { assertPositiveMinor } from '../utils/money.js';

export function getStarterAccountsSpec(currency) {
  return [
    { name: 'Cash Wallet', type: 'ASSET', subtype: 'CASH', currency, isSystem: true },
    { name: 'Primary Bank', type: 'ASSET', subtype: 'BANK', currency, isSystem: true },
    { name: 'Credit Card', type: 'LIABILITY', subtype: 'CARD', currency, isSystem: true },
    { name: 'Accounts Receivable', type: 'ASSET', subtype: 'RECEIVABLE', currency, isSystem: true },
    { name: 'Accounts Payable', type: 'LIABILITY', subtype: 'PAYABLE', currency, isSystem: true },
    { name: 'General Income', type: 'INCOME', subtype: 'OPERATING', currency, isSystem: true },
    { name: 'General Expense', type: 'EXPENSE', subtype: 'OPERATING', currency, isSystem: true },
    { name: 'Opening Balance Equity', type: 'EQUITY', subtype: 'EQUITY', currency, isSystem: true },
  ];
}

export async function ensureStarterAccounts(workspaceId, currency, session = null) {
  const existing = await Account.find({ workspace: workspaceId }).session(session || null);
  if (existing.length > 0) return existing;

  const docs = getStarterAccountsSpec(currency).map((acc) => ({
    ...acc,
    workspace: workspaceId,
    balanceMinor: 0,
  }));

  return Account.insertMany(docs, sessionOptions(session));
}

/**
 * Normal-balance sign convention:
 * - ASSET / EXPENSE are debit-normal (+DEBIT, -CREDIT)
 * - LIABILITY / INCOME / EQUITY are credit-normal (+CREDIT, -DEBIT)
 */
export function computeAccountBalanceDelta(accountType, side, amountMinor) {
  const isDebitNormal = accountType === 'ASSET' || accountType === 'EXPENSE';
  if (isDebitNormal) {
    return side === 'DEBIT' ? amountMinor : -amountMinor;
  }
  return side === 'CREDIT' ? amountMinor : -amountMinor;
}

export async function postJournalEntry(
  {
    workspaceId,
    referenceType,
    referenceId = null,
    description,
    date = new Date(),
    currency,
    entries,
    reversesJournalId = null,
    createdBy = null,
  },
  session = null
) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw ApiError.badRequest('A double-entry journal requires at least two entries', 'UNBALANCED_JOURNAL');
  }

  let debitSum = 0;
  let creditSum = 0;
  const normalizedEntries = entries.map((entry) => {
    const amountMinor = assertPositiveMinor(entry.amountMinor, 'entry.amountMinor');
    if (entry.side === 'DEBIT') debitSum += amountMinor;
    else if (entry.side === 'CREDIT') creditSum += amountMinor;
    else throw ApiError.badRequest(`Invalid journal side: ${entry.side}`, 'INVALID_JOURNAL_SIDE');

    return {
      account: entry.account,
      side: entry.side,
      amountMinor,
    };
  });

  if (debitSum !== creditSum || debitSum <= 0) {
    throw ApiError.badRequest(
      `Double-entry ledger invariant violated: debits (${debitSum}) !== credits (${creditSum})`,
      'UNBALANCED_JOURNAL'
    );
  }

  const accountIds = [...new Set(normalizedEntries.map((e) => String(e.account)))];
  const accounts = await Account.find({
    _id: { $in: accountIds },
    workspace: workspaceId,
  }).session(session || null);

  if (accounts.length !== accountIds.length) {
    throw ApiError.badRequest(
      'One or more accounts do not belong to the active workspace',
      'INVALID_ACCOUNT'
    );
  }

  const accountMap = new Map(accounts.map((acc) => [String(acc._id), acc]));

  const [journal] = await LedgerJournal.create(
    [
      {
        workspace: workspaceId,
        referenceType,
        referenceId,
        description,
        date,
        status: 'POSTED',
        reversesJournalId,
        currency,
        totalMinor: debitSum,
        entries: normalizedEntries,
        createdBy,
      },
    ],
    sessionOptions(session)
  );

  const entryDocs = normalizedEntries.map((e) => ({
    workspace: workspaceId,
    journal: journal._id,
    account: e.account,
    side: e.side,
    amountMinor: e.amountMinor,
    currency,
    date,
  }));
  await LedgerEntry.insertMany(entryDocs, sessionOptions(session));

  // Accumulate per-account net balance changes and apply atomically
  const deltas = new Map();
  for (const e of normalizedEntries) {
    const acc = accountMap.get(String(e.account));
    const delta = computeAccountBalanceDelta(acc.type, e.side, e.amountMinor);
    deltas.set(String(acc._id), (deltas.get(String(acc._id)) || 0) + delta);
  }

  for (const [accId, delta] of deltas.entries()) {
    if (delta !== 0) {
      await Account.updateOne(
        { _id: accId, workspace: workspaceId },
        { $inc: { balanceMinor: delta } },
        sessionOptions(session)
      );
    }
  }

  return journal;
}

export async function reverseJournalEntry(
  { workspaceId, journalId, description = null, createdBy = null, date = new Date() },
  session = null
) {
  const original = await LedgerJournal.findOne({
    _id: journalId,
    workspace: workspaceId,
  }).session(session || null);

  if (!original) {
    throw ApiError.notFound('Original ledger journal not found', 'JOURNAL_NOT_FOUND');
  }
  if (original.status === 'REVERSED') {
    throw ApiError.conflict('Ledger journal has already been reversed', 'JOURNAL_ALREADY_REVERSED');
  }

  const reversedEntries = original.entries.map((e) => ({
    account: e.account,
    side: e.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
    amountMinor: e.amountMinor,
  }));

  const reversalJournal = await postJournalEntry(
    {
      workspaceId,
      referenceType: 'REVERSAL',
      referenceId: original.referenceId,
      description: description || `Reversal of: ${original.description}`,
      date,
      currency: original.currency,
      entries: reversedEntries,
      reversesJournalId: original._id,
      createdBy,
    },
    session
  );

  original.status = 'REVERSED';
  original.reversedByJournalId = reversalJournal._id;
  await original.save(sessionOptions(session));

  return reversalJournal;
}

export async function findSystemAccount(workspaceId, { type, subtype }, session = null) {
  const account = await Account.findOne({
    workspace: workspaceId,
    type,
    subtype,
    archived: false,
  })
    .sort({ isSystem: -1, createdAt: 1 })
    .session(session || null);

  if (!account) {
    throw ApiError.badRequest(`Required ${type}/${subtype} account missing in workspace`, 'ACCOUNT_MISSING');
  }
  return account;
}
