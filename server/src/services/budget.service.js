import mongoose from 'mongoose';
import { Budget, Transaction } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatMinor } from '../utils/money.js';
import { createWorkspaceNotifications, emitWorkspaceEvent } from './notification.service.js';

export function getMonthKey(dateInput = new Date()) {
  const d = new Date(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function upsertBudget({
  workspaceId,
  category,
  monthKey,
  limitMinor,
  alertThresholdPercent = 80,
}) {
  const budget = await Budget.findOneAndUpdate(
    { workspace: workspaceId, category: category.trim(), monthKey },
    {
      $set: {
        limitMinor,
        alertThresholdPercent,
      },
      $setOnInsert: { lastAlertLevel: 0 },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return budget;
}

export async function listBudgetsWithSpend({ workspaceId, monthKey = getMonthKey() }) {
  const { start, end } = getMonthBounds(monthKey);
  const wsObjectId = new mongoose.Types.ObjectId(String(workspaceId));

  const [budgets, spendRows] = await Promise.all([
    Budget.find({ workspace: workspaceId, monthKey }).sort({ category: 1 }),
    Transaction.aggregate([
      {
        $match: {
          workspace: wsObjectId,
          type: 'EXPENSE',
          status: 'POSTED',
          occurredAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: '$category',
          spentMinor: { $sum: '$baseAmountMinor' },
        },
      },
    ]),
  ]);

  const spendMap = new Map(spendRows.map((r) => [r._id, r.spentMinor]));

  return budgets.map((b) => {
    const spentMinor = spendMap.get(b.category) || 0;
    const percentUsed = b.limitMinor > 0 ? Math.floor((spentMinor * 100) / b.limitMinor) : 0;
    let status = 'OK';
    if (percentUsed >= 100) status = 'EXCEEDED';
    else if (percentUsed >= b.alertThresholdPercent) status = 'WARNING';

    return {
      ...b.toObject(),
      spentMinor,
      remainingMinor: b.limitMinor - spentMinor,
      percentUsed,
      status,
    };
  });
}

export async function deleteBudget({ workspaceId, budgetId }) {
  const deleted = await Budget.findOneAndDelete({ _id: budgetId, workspace: workspaceId });
  if (!deleted) {
    throw ApiError.notFound('Budget not found', 'BUDGET_NOT_FOUND');
  }
  return { deleted: true };
}

export async function evaluateBudgetThreshold({ workspace, category, occurredAt }) {
  const monthKey = getMonthKey(occurredAt);
  const budget = await Budget.findOne({ workspace: workspace._id, category, monthKey });
  if (!budget) return null;

  const { start, end } = getMonthBounds(monthKey);
  const [agg] = await Transaction.aggregate([
    {
      $match: {
        workspace: workspace._id,
        type: 'EXPENSE',
        status: 'POSTED',
        category,
        occurredAt: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, totalMinor: { $sum: '$baseAmountMinor' } } },
  ]);

  const spentMinor = agg?.totalMinor || 0;
  const percentUsed = Math.floor((spentMinor * 100) / budget.limitMinor);
  const crossedLevel = percentUsed >= 100 ? 100 : percentUsed >= budget.alertThresholdPercent ? 80 : 0;

  if (crossedLevel > 0 && crossedLevel > budget.lastAlertLevel) {
    budget.lastAlertLevel = crossedLevel;
    await budget.save();

    const title =
      crossedLevel === 100
        ? `Budget exceeded: ${category}`
        : `Budget alert (${percentUsed}%): ${category}`;
    const message = `${category} spend reached ${formatMinor(spentMinor, workspace.baseCurrency)} of ${formatMinor(budget.limitMinor, workspace.baseCurrency)} for ${monthKey}.`;

    await createWorkspaceNotifications({
      workspaceId: workspace._id,
      type: 'BUDGET_ALERT',
      title,
      message,
      metadata: { category, monthKey, spentMinor, limitMinor: budget.limitMinor, percentUsed },
    });

    const payload = { category, monthKey, spentMinor, limitMinor: budget.limitMinor, percentUsed };
    emitWorkspaceEvent(workspace._id, 'budget:threshold_crossed', payload);
    emitWorkspaceEvent(workspace._id, 'notification:new', { title, message, type: 'BUDGET_ALERT' });
    return payload;
  }

  return null;
}
