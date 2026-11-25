import mongoose from 'mongoose';
import {
  ExpenseGroup,
  GroupExpense,
  Settlement,
  User,
} from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { distributeAmount, resolveFxConversion } from '../utils/money.js';
import { simplifyGroupDebts } from '../utils/debtSimplifier.js';
import { findSystemAccount, postJournalEntry } from './ledger.service.js';
import { createActivity, emitWorkspaceEvent } from './notification.service.js';

export async function createGroup({ workspace, actor, payload }) {
  const rawMembers = payload.members || [];
  const membersToInsert = [];

  for (const m of rawMembers) {
    let userId = m.userId || null;
    const email = (m.email || '').toLowerCase().trim();
    if (!userId && email) {
      const matchedUser = await User.findOne({ email }).select('_id');
      if (matchedUser) userId = matchedUser._id;
    }
    membersToInsert.push({
      userId,
      name: m.name.trim(),
      email,
    });
  }

  if (membersToInsert.length === 0) {
    membersToInsert.push({
      userId: actor._id,
      name: actor.name,
      email: actor.email,
    });
  }

  const group = await ExpenseGroup.create({
    workspace: workspace._id,
    name: payload.name.trim(),
    description: (payload.description || '').trim(),
    currency: payload.currency || workspace.baseCurrency,
    members: membersToInsert,
    createdBy: actor._id,
  });

  await createActivity({
    workspaceId: workspace._id,
    actorId: actor._id,
    type: 'GROUP_CREATED',
    title: 'Expense group created',
    message: `Created group "${group.name}" with ${group.members.length} members`,
    entityType: 'EXPENSE_GROUP',
    entityId: group._id,
  });

  return group;
}

export async function listGroups({ workspaceId }) {
  return ExpenseGroup.find({ workspace: workspaceId }).sort({ createdAt: -1 });
}

export async function getGroupById({ workspaceId, groupId }) {
  const group = await ExpenseGroup.findOne({ _id: groupId, workspace: workspaceId });
  if (!group) {
    throw ApiError.notFound('Expense group not found', 'GROUP_NOT_FOUND');
  }
  return group;
}

export async function addGroupMember({ workspaceId, groupId, member }) {
  const group = await getGroupById({ workspaceId, groupId });
  let userId = member.userId || null;
  const email = (member.email || '').toLowerCase().trim();
  if (!userId && email) {
    const matched = await User.findOne({ email }).select('_id');
    if (matched) userId = matched._id;
  }

  group.members.push({
    userId,
    name: member.name.trim(),
    email,
  });
  await group.save();
  return group;
}

export function computeGroupExpenseSplits({ totalMinor, splitType, splitsInput, groupMembers }) {
  const validMemberIds = new Set(groupMembers.map((m) => String(m._id)));
  const seen = new Set();

  for (const s of splitsInput) {
    const id = String(s.memberId);
    if (!validMemberIds.has(id)) {
      throw ApiError.badRequest(`Member ${id} is not part of this group`, 'INVALID_GROUP_MEMBER');
    }
    if (seen.has(id)) {
      throw ApiError.badRequest(`Duplicate split entry for member ${id}`, 'DUPLICATE_SPLIT_MEMBER');
    }
    seen.add(id);
  }

  if (splitsInput.length === 0) {
    throw ApiError.badRequest('At least one split participant is required', 'SPLITS_REQUIRED');
  }

  if (splitType === 'EQUAL') {
    const shares = distributeAmount(totalMinor, splitsInput.length);
    return splitsInput.map((s, idx) => ({
      memberId: new mongoose.Types.ObjectId(String(s.memberId)),
      shareValue: 1,
      owedMinor: shares[idx],
    }));
  }

  if (splitType === 'EXACT') {
    let sum = 0;
    const result = splitsInput.map((s) => {
      const owed = s.owedMinor ?? s.shareValue;
      if (!Number.isSafeInteger(owed) || owed < 0) {
        throw ApiError.badRequest('EXACT split owedMinor must be non-negative integer', 'INVALID_SPLIT');
      }
      sum += owed;
      return {
        memberId: new mongoose.Types.ObjectId(String(s.memberId)),
        shareValue: owed,
        owedMinor: owed,
      };
    });
    if (sum !== totalMinor) {
      throw ApiError.badRequest(
        `Exact splits sum (${sum}) must equal expense total (${totalMinor})`,
        'EXACT_SPLIT_MISMATCH'
      );
    }
    return result;
  }

  if (splitType === 'PERCENTAGE') {
    // Validate percentages sum exactly to 100 (within 10000 scaled integer = 100.0000%)
    let scaledSum = 0n;
    const positiveIndices = [];
    const positiveWeights = [];

    splitsInput.forEach((s, idx) => {
      const val = Number(s.shareValue);
      if (!Number.isFinite(val) || val < 0) {
        throw ApiError.badRequest('Percentage shareValue must be >= 0', 'INVALID_SPLIT');
      }
      const scaled = BigInt(Math.round(val * 10000));
      scaledSum += scaled;
      if (scaled > 0n) {
        positiveIndices.push(idx);
        positiveWeights.push(val);
      }
    });

    if (scaledSum !== 1_000_000n) {
      throw ApiError.badRequest('Percentage splits must sum to exactly 100%', 'PERCENTAGE_SUM_INVALID');
    }

    const distributed = distributeAmount(totalMinor, positiveWeights);
    const owedByIdx = new Map(positiveIndices.map((idx, dIdx) => [idx, distributed[dIdx]]));

    return splitsInput.map((s, idx) => ({
      memberId: new mongoose.Types.ObjectId(String(s.memberId)),
      shareValue: Number(s.shareValue),
      owedMinor: owedByIdx.get(idx) || 0,
    }));
  }

  if (splitType === 'SHARES') {
    const positiveIndices = [];
    const positiveWeights = [];
    splitsInput.forEach((s, idx) => {
      const val = Number(s.shareValue);
      if (!Number.isFinite(val) || val < 0) {
        throw ApiError.badRequest('Shares shareValue must be >= 0', 'INVALID_SPLIT');
      }
      if (val > 0) {
        positiveIndices.push(idx);
        positiveWeights.push(val);
      }
    });
    if (positiveWeights.length === 0) {
      throw ApiError.badRequest('At least one member must have positive shares', 'INVALID_SPLIT');
    }
    const distributed = distributeAmount(totalMinor, positiveWeights);
    const owedByIdx = new Map(positiveIndices.map((idx, dIdx) => [idx, distributed[dIdx]]));

    return splitsInput.map((s, idx) => ({
      memberId: new mongoose.Types.ObjectId(String(s.memberId)),
      shareValue: Number(s.shareValue),
      owedMinor: owedByIdx.get(idx) || 0,
    }));
  }

  throw ApiError.badRequest(`Unsupported splitType: ${splitType}`, 'INVALID_SPLIT_TYPE');
}

export async function addGroupExpense({ workspace, actor, groupId, payload }) {
  const group = await getGroupById({ workspaceId: workspace._id, groupId });
  const payerExists = group.members.some((m) => String(m._id) === String(payload.paidByMemberId));
  if (!payerExists) {
    throw ApiError.badRequest('Payer must be a member of the group', 'INVALID_PAYER');
  }

  const originalCurrency = payload.originalCurrency || group.currency;

  // Amount converted to workspace base currency for workspace-wide analytics
  const baseFx = resolveFxConversion({
    amountMinor: payload.originalAmountMinor,
    originalCurrency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  // Amount in group's native currency used for group splits & balances
  const groupFx =
    originalCurrency === group.currency
      ? { baseAmountMinor: payload.originalAmountMinor }
      : resolveFxConversion({
          amountMinor: payload.originalAmountMinor,
          originalCurrency,
          baseCurrency: group.currency,
          manualRate: group.currency === workspace.baseCurrency ? payload.manualRate : null,
        });

  const splitTotalMinor = groupFx.baseAmountMinor;
  const splitsInput =
    payload.splits && payload.splits.length > 0
      ? payload.splits
      : group.members.map((m) => ({ memberId: m._id, shareValue: 1 }));

  const computedSplits = computeGroupExpenseSplits({
    totalMinor: splitTotalMinor,
    splitType: payload.splitType,
    splitsInput,
    groupMembers: group.members,
  });

  const expense = await GroupExpense.create({
    workspace: workspace._id,
    group: group._id,
    title: payload.title.trim(),
    notes: (payload.notes || '').trim(),
    paidByMemberId: payload.paidByMemberId,
    originalAmountMinor: baseFx.originalAmountMinor,
    originalCurrency: baseFx.originalCurrency,
    exchangeRate: baseFx.exchangeRate,
    rateSource: baseFx.rateSource,
    baseAmountMinor: baseFx.baseAmountMinor,
    splitType: payload.splitType,
    splits: computedSplits,
    occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
    receiptIds: payload.receiptIds || [],
    createdBy: actor._id,
  });

  await createActivity({
    workspaceId: workspace._id,
    actorId: actor._id,
    type: 'GROUP_EXPENSE_ADDED',
    title: 'Group expense added',
    message: `${expense.title} in ${group.name}`,
    entityType: 'GROUP_EXPENSE',
    entityId: expense._id,
    metadata: { groupId: String(group._id), amountMinor: splitTotalMinor, currency: group.currency },
  });

  emitWorkspaceEvent(workspace._id, 'group:expense_added', {
    groupId: String(group._id),
    expense,
  });

  return expense;
}

export async function updateGroupExpense({ workspace, actor, groupId, expenseId, payload }) {
  const group = await getGroupById({ workspaceId: workspace._id, groupId });
  const existing = await GroupExpense.findOne({
    _id: expenseId,
    group: group._id,
    workspace: workspace._id,
  });
  if (!existing) {
    throw ApiError.notFound('Group expense not found', 'EXPENSE_NOT_FOUND');
  }

  const paidByMemberId = payload.paidByMemberId || existing.paidByMemberId;
  if (!group.members.some((m) => String(m._id) === String(paidByMemberId))) {
    throw ApiError.badRequest('Payer must be a member of the group', 'INVALID_PAYER');
  }

  const originalAmountMinor = payload.originalAmountMinor ?? existing.originalAmountMinor;
  const originalCurrency = payload.originalCurrency || existing.originalCurrency;
  const splitType = payload.splitType || existing.splitType;

  const baseFx = resolveFxConversion({
    amountMinor: originalAmountMinor,
    originalCurrency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  const groupFx =
    originalCurrency === group.currency
      ? { baseAmountMinor: originalAmountMinor }
      : resolveFxConversion({
          amountMinor: originalAmountMinor,
          originalCurrency,
          baseCurrency: group.currency,
          manualRate: group.currency === workspace.baseCurrency ? payload.manualRate : null,
        });

  const splitsInput = payload.splits || existing.splits;
  const computedSplits = computeGroupExpenseSplits({
    totalMinor: groupFx.baseAmountMinor,
    splitType,
    splitsInput,
    groupMembers: group.members,
  });

  existing.title = payload.title ? payload.title.trim() : existing.title;
  existing.notes = payload.notes !== undefined ? payload.notes.trim() : existing.notes;
  existing.paidByMemberId = paidByMemberId;
  existing.originalAmountMinor = baseFx.originalAmountMinor;
  existing.originalCurrency = baseFx.originalCurrency;
  existing.exchangeRate = baseFx.exchangeRate;
  existing.rateSource = baseFx.rateSource;
  existing.baseAmountMinor = baseFx.baseAmountMinor;
  existing.splitType = splitType;
  existing.splits = computedSplits;
  if (payload.occurredAt) existing.occurredAt = new Date(payload.occurredAt);
  await existing.save();

  emitWorkspaceEvent(workspace._id, 'group:expense_added', {
    groupId: String(group._id),
    expense: existing,
    updatedBy: String(actor._id),
  });

  return existing;
}

export async function deleteGroupExpense({ workspaceId, groupId, expenseId }) {
  const deleted = await GroupExpense.findOneAndDelete({
    _id: expenseId,
    group: groupId,
    workspace: workspaceId,
  });
  if (!deleted) {
    throw ApiError.notFound('Group expense not found', 'EXPENSE_NOT_FOUND');
  }
  emitWorkspaceEvent(workspaceId, 'group:expense_added', {
    groupId: String(groupId),
    deletedExpenseId: String(expenseId),
  });
  return { deleted: true };
}

export async function getGroupDetailsAndBalances({ workspaceId, groupId }) {
  const group = await getGroupById({ workspaceId, groupId });
  const [expenses, settlements] = await Promise.all([
    GroupExpense.find({ workspace: workspaceId, group: group._id }).sort({
      occurredAt: -1,
      createdAt: -1,
    }),
    Settlement.find({ workspace: workspaceId, group: group._id }).sort({
      settledAt: -1,
      createdAt: -1,
    }),
  ]);

  const stats = new Map();
  for (const m of group.members) {
    stats.set(String(m._id), {
      memberId: String(m._id),
      userId: m.userId ? String(m.userId) : null,
      name: m.name,
      email: m.email,
      paidMinor: 0,
      owedMinor: 0,
      settlementsPaidMinor: 0,
      settlementsReceivedMinor: 0,
      balanceMinor: 0,
    });
  }

  for (const exp of expenses) {
    const expenseGroupTotal = exp.splits.reduce((acc, s) => acc + s.owedMinor, 0);
    const payerStat = stats.get(String(exp.paidByMemberId));
    if (payerStat) {
      payerStat.paidMinor += expenseGroupTotal;
    }
    for (const s of exp.splits) {
      const mStat = stats.get(String(s.memberId));
      if (mStat) {
        mStat.owedMinor += s.owedMinor;
      }
    }
  }

  for (const st of settlements) {
    const fromStat = stats.get(String(st.fromMemberId));
    const toStat = stats.get(String(st.toMemberId));
    if (fromStat) fromStat.settlementsPaidMinor += st.amountMinor;
    if (toStat) toStat.settlementsReceivedMinor += st.amountMinor;
  }

  const memberBalances = Array.from(stats.values()).map((s) => {
    const balanceMinor =
      s.paidMinor - s.owedMinor + s.settlementsPaidMinor - s.settlementsReceivedMinor;
    return {
      ...s,
      balanceMinor,
    };
  });

  const simplifiedDebts = simplifyGroupDebts(
    memberBalances.map((m) => ({
      memberId: m.memberId,
      name: m.name,
      balanceMinor: m.balanceMinor,
    }))
  );

  const totalSpendMinor = expenses.reduce(
    (acc, e) => acc + e.splits.reduce((sAcc, s) => sAcc + s.owedMinor, 0),
    0
  );

  return {
    group,
    expenses,
    settlements,
    memberBalances,
    simplifiedDebts,
    totalSpendMinor,
  };
}

export async function recordGroupSettlement({ workspace, actor, groupId, payload }) {
  const group = await getGroupById({ workspaceId: workspace._id, groupId });
  const fromMember = group.members.find((m) => String(m._id) === String(payload.fromMemberId));
  const toMember = group.members.find((m) => String(m._id) === String(payload.toMemberId));

  if (!fromMember || !toMember) {
    throw ApiError.badRequest('Both members must belong to the group', 'INVALID_GROUP_MEMBER');
  }
  if (String(fromMember._id) === String(toMember._id)) {
    throw ApiError.badRequest('Cannot settle with the same member', 'INVALID_SETTLEMENT');
  }

  const currency = payload.currency || group.currency;
  const fx = resolveFxConversion({
    amountMinor: payload.amountMinor,
    originalCurrency: currency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  const settlement = await runInTransaction(async (session) => {
    const settledAt = payload.settledAt ? new Date(payload.settledAt) : new Date();
    const [created] = await Settlement.create(
      [
        {
          workspace: workspace._id,
          group: group._id,
          fromMemberId: fromMember._id,
          toMemberId: toMember._id,
          amountMinor: payload.amountMinor,
          currency,
          exchangeRate: fx.exchangeRate,
          rateSource: fx.rateSource,
          baseAmountMinor: fx.baseAmountMinor,
          note: (payload.note || '').trim(),
          settledAt,
          createdBy: actor._id,
        },
      ],
      sessionOptions(session)
    );

    // Post balanced double-entry ledger journal for the settlement
    const actorIsPayer =
      (fromMember.userId && String(fromMember.userId) === String(actor._id)) ||
      (fromMember.email && fromMember.email.toLowerCase() === actor.email.toLowerCase());
    const actorIsReceiver =
      (toMember.userId && String(toMember.userId) === String(actor._id)) ||
      (toMember.email && toMember.email.toLowerCase() === actor.email.toLowerCase());

    let entries;
    if (actorIsPayer) {
      const cashOrBank = payload.accountId
        ? { _id: payload.accountId }
        : await findSystemAccount(workspace._id, { type: 'ASSET', subtype: 'BANK' }, session);
      const payableAcc = await findSystemAccount(
        workspace._id,
        { type: 'LIABILITY', subtype: 'PAYABLE' },
        session
      );
      entries = [
        { account: payableAcc._id, side: 'DEBIT', amountMinor: fx.baseAmountMinor },
        { account: cashOrBank._id, side: 'CREDIT', amountMinor: fx.baseAmountMinor },
      ];
    } else if (actorIsReceiver) {
      const cashOrBank = payload.accountId
        ? { _id: payload.accountId }
        : await findSystemAccount(workspace._id, { type: 'ASSET', subtype: 'BANK' }, session);
      const receivableAcc = await findSystemAccount(
        workspace._id,
        { type: 'ASSET', subtype: 'RECEIVABLE' },
        session
      );
      entries = [
        { account: cashOrBank._id, side: 'DEBIT', amountMinor: fx.baseAmountMinor },
        { account: receivableAcc._id, side: 'CREDIT', amountMinor: fx.baseAmountMinor },
      ];
    } else {
      const receivableAcc = await findSystemAccount(
        workspace._id,
        { type: 'ASSET', subtype: 'RECEIVABLE' },
        session
      );
      const payableAcc = await findSystemAccount(
        workspace._id,
        { type: 'LIABILITY', subtype: 'PAYABLE' },
        session
      );
      entries = [
        { account: receivableAcc._id, side: 'DEBIT', amountMinor: fx.baseAmountMinor },
        { account: payableAcc._id, side: 'CREDIT', amountMinor: fx.baseAmountMinor },
      ];
    }

    const journal = await postJournalEntry(
      {
        workspaceId: workspace._id,
        referenceType: 'SETTLEMENT',
        referenceId: created._id,
        description: `Group settlement (${group.name}): ${fromMember.name} -> ${toMember.name}`,
        date: settledAt,
        currency: workspace.baseCurrency,
        entries,
        createdBy: actor._id,
      },
      session
    );

    created.ledgerJournalId = journal._id;
    await created.save(sessionOptions(session));

    await createActivity(
      {
        workspaceId: workspace._id,
        actorId: actor._id,
        type: 'GROUP_SETTLED',
        title: 'Group debt settled',
        message: `${fromMember.name} settled with ${toMember.name} in ${group.name}`,
        entityType: 'SETTLEMENT',
        entityId: created._id,
        metadata: { groupId: String(group._id), amountMinor: payload.amountMinor, currency },
      },
      session
    );

    return created;
  });

  const details = await getGroupDetailsAndBalances({
    workspaceId: workspace._id,
    groupId: group._id,
  });

  emitWorkspaceEvent(workspace._id, 'group:settled', {
    groupId: String(group._id),
    settlement,
    simplifiedDebts: details.simplifiedDebts,
  });

  return {
    settlement,
    ...details,
  };
}
