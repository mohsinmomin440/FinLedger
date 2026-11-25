import { Account, Transaction } from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { resolveFxConversion } from '../utils/money.js';
import {
  findSystemAccount,
  postJournalEntry,
  reverseJournalEntry,
} from './ledger.service.js';
import { createActivity, emitWorkspaceEvent } from './notification.service.js';
import { evaluateBudgetThreshold } from './budget.service.js';

async function buildJournalEntriesForTx({ workspaceId, type, accountId, toAccountId, amountMinor }, session) {
  if (type === 'INCOME') {
    const incomeAccount = await findSystemAccount(
      workspaceId,
      { type: 'INCOME', subtype: 'OPERATING' },
      session
    );
    return [
      { account: accountId, side: 'DEBIT', amountMinor },
      { account: incomeAccount._id, side: 'CREDIT', amountMinor },
    ];
  }

  if (type === 'EXPENSE') {
    const expenseAccount = await findSystemAccount(
      workspaceId,
      { type: 'EXPENSE', subtype: 'OPERATING' },
      session
    );
    return [
      { account: expenseAccount._id, side: 'DEBIT', amountMinor },
      { account: accountId, side: 'CREDIT', amountMinor },
    ];
  }

  if (type === 'TRANSFER') {
    if (!toAccountId || String(toAccountId) === String(accountId)) {
      throw ApiError.badRequest(
        'Transfer requires a distinct destination account',
        'INVALID_TRANSFER_ACCOUNTS'
      );
    }
    return [
      { account: toAccountId, side: 'DEBIT', amountMinor },
      { account: accountId, side: 'CREDIT', amountMinor },
    ];
  }

  throw ApiError.badRequest(`Unsupported transaction type: ${type}`, 'INVALID_TX_TYPE');
}

export async function createTransaction({ workspace, actorId = null, payload }) {
  const originalCurrency = payload.originalCurrency || workspace.baseCurrency;
  const fx = resolveFxConversion({
    amountMinor: payload.originalAmountMinor,
    originalCurrency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  const txDoc = await runInTransaction(async (session) => {
    const account = await Account.findOne({
      _id: payload.accountId,
      workspace: workspace._id,
      archived: false,
    }).session(session || null);
    if (!account) {
      throw ApiError.badRequest('Source account not found in workspace', 'ACCOUNT_NOT_FOUND');
    }

    if (payload.type === 'TRANSFER') {
      const destAccount = await Account.findOne({
        _id: payload.toAccountId,
        workspace: workspace._id,
        archived: false,
      }).session(session || null);
      if (!destAccount) {
        throw ApiError.badRequest('Destination account not found in workspace', 'ACCOUNT_NOT_FOUND');
      }
    }

    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const [tx] = await Transaction.create(
      [
        {
          workspace: workspace._id,
          type: payload.type,
          account: payload.accountId,
          toAccount: payload.type === 'TRANSFER' ? payload.toAccountId : null,
          category: payload.type === 'TRANSFER' ? 'Transfer' : payload.category,
          description: payload.description.trim(),
          originalAmountMinor: fx.originalAmountMinor,
          originalCurrency: fx.originalCurrency,
          exchangeRate: fx.exchangeRate,
          rateSource: fx.rateSource,
          baseAmountMinor: fx.baseAmountMinor,
          occurredAt,
          recurringRuleId: payload.recurringRuleId || null,
          receiptIds: payload.receiptIds || [],
          status: 'POSTED',
          createdBy: actorId,
        },
      ],
      sessionOptions(session)
    );

    const entries = await buildJournalEntriesForTx(
      {
        workspaceId: workspace._id,
        type: payload.type,
        accountId: payload.accountId,
        toAccountId: payload.toAccountId,
        amountMinor: fx.baseAmountMinor,
      },
      session
    );

    const journal = await postJournalEntry(
      {
        workspaceId: workspace._id,
        referenceType: payload.type === 'TRANSFER' ? 'TRANSFER' : 'TRANSACTION',
        referenceId: tx._id,
        description: `${payload.type}: ${tx.description}`,
        date: occurredAt,
        currency: workspace.baseCurrency,
        entries,
        createdBy: actorId,
      },
      session
    );

    tx.ledgerJournalId = journal._id;
    await tx.save(sessionOptions(session));

    await createActivity(
      {
        workspaceId: workspace._id,
        actorId,
        type: `TRANSACTION_${payload.type}`,
        title: `${payload.type} recorded`,
        message: tx.description,
        entityType: 'TRANSACTION',
        entityId: tx._id,
        metadata: { baseAmountMinor: tx.baseAmountMinor, category: tx.category },
      },
      session
    );

    return tx;
  });

  if (txDoc.type === 'EXPENSE') {
    await evaluateBudgetThreshold({
      workspace,
      category: txDoc.category,
      occurredAt: txDoc.occurredAt,
    });
  }

  const populated = await Transaction.findById(txDoc._id)
    .populate('account', 'name type subtype currency')
    .populate('toAccount', 'name type subtype currency');

  emitWorkspaceEvent(workspace._id, 'transaction:created', populated);
  return populated;
}

export async function updateTransaction({ workspace, actorId, transactionId, payload }) {
  const existing = await Transaction.findOne({
    _id: transactionId,
    workspace: workspace._id,
  });
  if (!existing) {
    throw ApiError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
  }
  if (existing.status === 'VOIDED') {
    throw ApiError.badRequest('Voided transactions cannot be modified', 'TRANSACTION_VOIDED');
  }

  const nextType = payload.type || existing.type;
  const nextAccountId = payload.accountId || existing.account;
  const nextToAccountId = nextType === 'TRANSFER' ? payload.toAccountId || existing.toAccount : null;
  const nextAmountMinor = payload.originalAmountMinor ?? existing.originalAmountMinor;
  const nextCurrency = payload.originalCurrency || existing.originalCurrency;
  const fx = resolveFxConversion({
    amountMinor: nextAmountMinor,
    originalCurrency: nextCurrency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  const updated = await runInTransaction(async (session) => {
    if (existing.ledgerJournalId) {
      await reverseJournalEntry(
        {
          workspaceId: workspace._id,
          journalId: existing.ledgerJournalId,
          description: `Reversal for edit of: ${existing.description}`,
          createdBy: actorId,
        },
        session
      );
    }

    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : existing.occurredAt;
    const entries = await buildJournalEntriesForTx(
      {
        workspaceId: workspace._id,
        type: nextType,
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        amountMinor: fx.baseAmountMinor,
      },
      session
    );

    const newDescription = payload.description ? payload.description.trim() : existing.description;
    const newJournal = await postJournalEntry(
      {
        workspaceId: workspace._id,
        referenceType: nextType === 'TRANSFER' ? 'TRANSFER' : 'TRANSACTION',
        referenceId: existing._id,
        description: `${nextType}: ${newDescription} (edited)`,
        date: occurredAt,
        currency: workspace.baseCurrency,
        entries,
        createdBy: actorId,
      },
      session
    );

    existing.type = nextType;
    existing.account = nextAccountId;
    existing.toAccount = nextToAccountId;
    existing.category =
      nextType === 'TRANSFER' ? 'Transfer' : payload.category || existing.category;
    existing.description = newDescription;
    existing.originalAmountMinor = fx.originalAmountMinor;
    existing.originalCurrency = fx.originalCurrency;
    existing.exchangeRate = fx.exchangeRate;
    existing.rateSource = fx.rateSource;
    existing.baseAmountMinor = fx.baseAmountMinor;
    existing.occurredAt = occurredAt;
    if (payload.receiptIds !== undefined) existing.receiptIds = payload.receiptIds;
    existing.ledgerJournalId = newJournal._id;

    await existing.save(sessionOptions(session));
    return existing;
  });

  if (updated.type === 'EXPENSE') {
    await evaluateBudgetThreshold({
      workspace,
      category: updated.category,
      occurredAt: updated.occurredAt,
    });
  }

  return Transaction.findById(updated._id)
    .populate('account', 'name type subtype currency')
    .populate('toAccount', 'name type subtype currency');
}

export async function voidTransaction({ workspace, actorId, transactionId }) {
  const result = await runInTransaction(async (session) => {
    const tx = await Transaction.findOne({
      _id: transactionId,
      workspace: workspace._id,
    }).session(session || null);

    if (!tx) {
      throw ApiError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
    }
    if (tx.status === 'VOIDED') {
      throw ApiError.conflict('Transaction is already voided', 'ALREADY_VOIDED');
    }

    let reversalJournal = null;
    if (tx.ledgerJournalId) {
      reversalJournal = await reverseJournalEntry(
        {
          workspaceId: workspace._id,
          journalId: tx.ledgerJournalId,
          description: `Voided ${tx.type}: ${tx.description}`,
          createdBy: actorId,
        },
        session
      );
    }

    tx.status = 'VOIDED';
    await tx.save(sessionOptions(session));

    await createActivity(
      {
        workspaceId: workspace._id,
        actorId,
        type: 'TRANSACTION_VOIDED',
        title: 'Transaction voided',
        message: `Reversed ${tx.description}`,
        entityType: 'TRANSACTION',
        entityId: tx._id,
      },
      session
    );

    return { transaction: tx, reversalJournal };
  });

  return result;
}

export async function listTransactions({ workspaceId, query = {} }) {
  const {
    page = 1,
    limit = 25,
    type,
    accountId,
    category,
    q,
    from,
    to,
    includeVoided = false,
  } = query;

  const filter = { workspace: workspaceId };
  if (!includeVoided) filter.status = 'POSTED';
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (accountId) {
    filter.$or = [{ account: accountId }, { toAccount: accountId }];
  }
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(from);
    if (to) filter.occurredAt.$lte = new Date(to);
  }
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { description: { $regex: escaped, $options: 'i' } },
          { category: { $regex: escaped, $options: 'i' } },
        ],
      },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ occurredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('account', 'name type subtype currency')
      .populate('toAccount', 'name type subtype currency'),
    Transaction.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
