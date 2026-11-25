import { Account, LedgerEntry, LedgerJournal } from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { findSystemAccount, postJournalEntry } from '../services/ledger.service.js';
import { resolveFxConversion } from '../utils/money.js';

export const listAccounts = asyncHandler(async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const filter = { workspace: req.workspace._id };
  if (!includeArchived) filter.archived = false;

  const accounts = await Account.find(filter).sort({ type: 1, isSystem: -1, name: 1 });
  return sendSuccess(res, { data: accounts });
});

export const createAccount = asyncHandler(async (req, res) => {
  const { name, type, subtype, currency, openingBalanceMinor = 0 } = req.body;
  const accountCurrency = currency || req.workspace.baseCurrency;

  const account = await runInTransaction(async (session) => {
    const [created] = await Account.create(
      [
        {
          workspace: req.workspace._id,
          name: name.trim(),
          type,
          subtype,
          currency: accountCurrency,
          balanceMinor: 0,
          isSystem: false,
        },
      ],
      sessionOptions(session)
    );

    if (openingBalanceMinor > 0) {
      const fx = resolveFxConversion({
        amountMinor: openingBalanceMinor,
        originalCurrency: accountCurrency,
        baseCurrency: req.workspace.baseCurrency,
      });
      const equityAcc = await findSystemAccount(
        req.workspace._id,
        { type: 'EQUITY', subtype: 'EQUITY' },
        session
      );

      const isDebitNormal = type === 'ASSET' || type === 'EXPENSE';
      const entries = isDebitNormal
        ? [
            { account: created._id, side: 'DEBIT', amountMinor: fx.baseAmountMinor },
            { account: equityAcc._id, side: 'CREDIT', amountMinor: fx.baseAmountMinor },
          ]
        : [
            { account: equityAcc._id, side: 'DEBIT', amountMinor: fx.baseAmountMinor },
            { account: created._id, side: 'CREDIT', amountMinor: fx.baseAmountMinor },
          ];

      await postJournalEntry(
        {
          workspaceId: req.workspace._id,
          referenceType: 'OPENING',
          referenceId: created._id,
          description: `Opening balance for ${created.name}`,
          currency: req.workspace.baseCurrency,
          entries,
          createdBy: req.user._id,
        },
        session
      );
    }

    return Account.findById(created._id).session(session || null);
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created',
    data: account,
  });
});

export const updateAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!account) throw ApiError.notFound('Account not found', 'ACCOUNT_NOT_FOUND');

  if (req.body.name !== undefined) account.name = req.body.name.trim();
  if (req.body.archived !== undefined) {
    if (account.isSystem && req.body.archived) {
      throw ApiError.badRequest('System ledger accounts cannot be archived', 'SYSTEM_ACCOUNT');
    }
    account.archived = req.body.archived;
  }

  await account.save();
  return sendSuccess(res, { message: 'Account updated', data: account });
});

export const listLedgerJournals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, accountId, referenceType } = req.query;
  const filter = { workspace: req.workspace._id };
  if (referenceType) filter.referenceType = referenceType;
  if (accountId) filter['entries.account'] = accountId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LedgerJournal.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('entries.account', 'name type subtype currency'),
    LedgerJournal.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: items,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const listLedgerEntries = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, accountId } = req.query;
  const filter = { workspace: req.workspace._id };
  if (accountId) filter.account = accountId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LedgerEntry.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('account', 'name type subtype currency')
      .populate('journal', 'description referenceType status'),
    LedgerEntry.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: items,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});
