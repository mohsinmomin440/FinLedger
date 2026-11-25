import mongoose from 'mongoose';
import {
  Account,
  ExpenseGroup,
  GroupExpense,
  Invoice,
  Settlement,
  Transaction,
} from '../models/index.js';
import { buildCsv } from '../utils/csv.js';
import { formatMinor } from '../utils/money.js';
import { getMonthBounds, getMonthKey, listBudgetsWithSpend } from './budget.service.js';
import { buildMonthlyStatementPdfBuffer } from './pdf.service.js';

function getRecentMonthKeys(count = 6, anchorDate = new Date()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i, 1));
    keys.push(getMonthKey(d));
  }
  return keys;
}

export async function getAnalyticsOverview({
  workspace,
  user,
  monthKey = getMonthKey(),
  months = 6,
}) {
  const wsId = new mongoose.Types.ObjectId(String(workspace._id));
  const { start: monthStart, end: monthEnd } = getMonthBounds(monthKey);
  const recentKeys = getRecentMonthKeys(months);
  const { start: seriesStart } = getMonthBounds(recentKeys[0]);

  const [
    accounts,
    monthlyTxAgg,
    categoryAgg,
    seriesAgg,
    budgets,
    invoices,
    groups,
    groupExpenses,
    settlements,
    recentTransactions,
  ] = await Promise.all([
    Account.find({ workspace: wsId, archived: false }),
    Transaction.aggregate([
      {
        $match: {
          workspace: wsId,
          status: 'POSTED',
          occurredAt: { $gte: monthStart, $lt: monthEnd },
          type: { $in: ['INCOME', 'EXPENSE'] },
        },
      },
      {
        $group: {
          _id: '$type',
          totalMinor: { $sum: '$baseAmountMinor' },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $match: {
          workspace: wsId,
          status: 'POSTED',
          type: 'EXPENSE',
          occurredAt: { $gte: monthStart, $lt: monthEnd },
        },
      },
      {
        $group: {
          _id: '$category',
          totalMinor: { $sum: '$baseAmountMinor' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalMinor: -1 } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          workspace: wsId,
          status: 'POSTED',
          type: { $in: ['INCOME', 'EXPENSE'] },
          occurredAt: { $gte: seriesStart, $lt: monthEnd },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: { date: '$occurredAt', timezone: 'UTC' } },
            month: { $month: { date: '$occurredAt', timezone: 'UTC' } },
            type: '$type',
          },
          totalMinor: { $sum: '$baseAmountMinor' },
        },
      },
    ]),
    listBudgetsWithSpend({ workspaceId: wsId, monthKey }),
    Invoice.find({ workspace: wsId }),
    ExpenseGroup.find({ workspace: wsId }),
    GroupExpense.find({ workspace: wsId }),
    Settlement.find({ workspace: wsId }),
    Transaction.find({ workspace: wsId, status: 'POSTED' })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(8)
      .populate('account', 'name type subtype currency')
      .populate('toAccount', 'name type subtype currency'),
  ]);

  let liquidBalanceMinor = 0;
  let accountsReceivableMinor = 0;
  for (const acc of accounts) {
    if (acc.type === 'ASSET' && (acc.subtype === 'CASH' || acc.subtype === 'BANK')) {
      liquidBalanceMinor += acc.balanceMinor;
    } else if (acc.type === 'LIABILITY' && acc.subtype === 'CARD') {
      liquidBalanceMinor -= acc.balanceMinor;
    } else if (acc.type === 'ASSET' && acc.subtype === 'RECEIVABLE') {
      accountsReceivableMinor += acc.balanceMinor;
    }
  }

  const monthlyIncomeMinor = monthlyTxAgg.find((r) => r._id === 'INCOME')?.totalMinor || 0;
  const monthlyExpenseMinor = monthlyTxAgg.find((r) => r._id === 'EXPENSE')?.totalMinor || 0;
  const monthlyCashflowMinor = monthlyIncomeMinor - monthlyExpenseMinor;

  // Build continuous monthly series
  const seriesMap = new Map();
  for (const key of recentKeys) {
    seriesMap.set(key, { monthKey: key, incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  }
  for (const row of seriesAgg) {
    const k = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
    const entry = seriesMap.get(k);
    if (!entry) continue;
    if (row._id.type === 'INCOME') entry.incomeMinor = row.totalMinor;
    if (row._id.type === 'EXPENSE') entry.expenseMinor = row.totalMinor;
    entry.netMinor = entry.incomeMinor - entry.expenseMinor;
  }

  // Group balances for current user & group spend summary
  let youOweMinor = 0;
  let owedToYouMinor = 0;
  const groupSpend = [];
  const expensesByGroup = new Map();
  const settlementsByGroup = new Map();

  for (const exp of groupExpenses) {
    const gid = String(exp.group);
    if (!expensesByGroup.has(gid)) expensesByGroup.set(gid, []);
    expensesByGroup.get(gid).push(exp);
  }
  for (const st of settlements) {
    const gid = String(st.group);
    if (!settlementsByGroup.has(gid)) settlementsByGroup.set(gid, []);
    settlementsByGroup.get(gid).push(st);
  }

  for (const grp of groups) {
    const gid = String(grp._id);
    const gExps = expensesByGroup.get(gid) || [];
    const gSts = settlementsByGroup.get(gid) || [];

    const totalBaseSpend = gExps.reduce((sum, e) => sum + e.baseAmountMinor, 0);
    groupSpend.push({
      groupId: gid,
      name: grp.name,
      currency: grp.currency,
      expenseCount: gExps.length,
      totalBaseMinor: totalBaseSpend,
    });

    if (user) {
      const meMember = grp.members.find(
        (m) =>
          (m.userId && String(m.userId) === String(user._id)) ||
          (m.email && m.email.toLowerCase() === user.email.toLowerCase())
      );
      if (meMember) {
        let myBalance = 0;
        const myId = String(meMember._id);
        for (const e of gExps) {
          const eTotal = e.splits.reduce((a, s) => a + s.owedMinor, 0);
          if (String(e.paidByMemberId) === myId) myBalance += eTotal;
          const mySplit = e.splits.find((s) => String(s.memberId) === myId);
          if (mySplit) myBalance -= mySplit.owedMinor;
        }
        for (const s of gSts) {
          if (String(s.fromMemberId) === myId) myBalance += s.amountMinor;
          if (String(s.toMemberId) === myId) myBalance -= s.amountMinor;
        }
        if (myBalance > 0) owedToYouMinor += myBalance;
        else if (myBalance < 0) youOweMinor += -myBalance;
      }
    }
  }

  // Invoice aging
  const now = new Date();
  const aging = {
    DRAFT: { count: 0, totalMinor: 0 },
    SENT: { count: 0, totalMinor: 0 },
    PARTIAL: { count: 0, totalMinor: 0 },
    OVERDUE: { count: 0, totalMinor: 0 },
    PAID: { count: 0, totalMinor: 0 },
    VOID: { count: 0, totalMinor: 0 },
  };
  let unpaidInvoicesMinor = 0;
  let unpaidInvoicesCount = 0;

  for (const inv of invoices) {
    let effectiveStatus = inv.status;
    if ((effectiveStatus === 'SENT' || effectiveStatus === 'PARTIAL') && inv.dueDate < now) {
      effectiveStatus = 'OVERDUE';
    }
    if (aging[effectiveStatus]) {
      aging[effectiveStatus].count += 1;
      const balanceMinor =
        effectiveStatus === 'PAID' ? inv.totalMinor : Math.max(0, inv.totalMinor - inv.paidMinor);
      aging[effectiveStatus].totalMinor += balanceMinor;
    }
    if (['SENT', 'PARTIAL', 'OVERDUE'].includes(effectiveStatus)) {
      unpaidInvoicesMinor += Math.max(0, inv.totalMinor - inv.paidMinor);
      unpaidInvoicesCount += 1;
    }
  }

  return {
    monthKey,
    kpis: {
      netBalanceMinor: liquidBalanceMinor,
      accountsReceivableMinor,
      monthlyIncomeMinor,
      monthlyExpenseMinor,
      monthlyCashflowMinor,
      youOweMinor,
      owedToYouMinor,
      unpaidInvoicesMinor,
      unpaidInvoicesCount,
    },
    monthlyCashflow: Array.from(seriesMap.values()),
    categoryBreakdown: categoryAgg.map((c) => ({
      category: c._id,
      totalMinor: c.totalMinor,
      count: c.count,
    })),
    budgets,
    groupSpend,
    invoiceAging: aging,
    profitAndLoss: {
      monthKey,
      incomeMinor: monthlyIncomeMinor,
      expenseMinor: monthlyExpenseMinor,
      netProfitMinor: monthlyCashflowMinor,
    },
    recentTransactions,
  };
}

export async function exportTransactionsCsv({ workspace, from, to }) {
  const filter = { workspace: workspace._id, status: 'POSTED' };
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(from);
    if (to) filter.occurredAt.$lte = new Date(to);
  }

  const transactions = await Transaction.find(filter)
    .sort({ occurredAt: -1 })
    .populate('account', 'name')
    .populate('toAccount', 'name');

  const headers = [
    'Date',
    'Type',
    'Category',
    'Description',
    'Account',
    'To Account',
    'Original Amount',
    'Original Currency',
    'FX Rate',
    `Base Amount (${workspace.baseCurrency})`,
  ];

  const rows = transactions.map((tx) => [
    new Date(tx.occurredAt).toISOString().slice(0, 10),
    tx.type,
    tx.category,
    tx.description,
    tx.account?.name || '',
    tx.toAccount?.name || '',
    formatMinor(tx.originalAmountMinor, tx.originalCurrency),
    tx.originalCurrency,
    tx.exchangeRate,
    formatMinor(tx.baseAmountMinor, workspace.baseCurrency),
  ]);

  return buildCsv(headers, rows);
}

export async function generateMonthlyStatementPdf({ workspace, monthKey = getMonthKey() }) {
  const { start, end } = getMonthBounds(monthKey);

  const [accounts, periodTransactions, postPeriodAgg] = await Promise.all([
    Account.find({ workspace: workspace._id, archived: false }).sort({ type: 1, name: 1 }),
    Transaction.find({
      workspace: workspace._id,
      status: 'POSTED',
      occurredAt: { $gte: start, $lt: end },
    }).sort({ occurredAt: 1 }),
    Transaction.aggregate([
      {
        $match: {
          workspace: workspace._id,
          status: 'POSTED',
          occurredAt: { $gte: end },
          type: { $in: ['INCOME', 'EXPENSE'] },
        },
      },
      {
        $group: {
          _id: '$type',
          totalMinor: { $sum: '$baseAmountMinor' },
        },
      },
    ]),
  ]);

  let currentLiquidMinor = 0;
  for (const acc of accounts) {
    if (acc.type === 'ASSET' && (acc.subtype === 'CASH' || acc.subtype === 'BANK')) {
      currentLiquidMinor += acc.balanceMinor;
    } else if (acc.type === 'LIABILITY' && acc.subtype === 'CARD') {
      currentLiquidMinor -= acc.balanceMinor;
    }
  }

  const afterIncome = postPeriodAgg.find((r) => r._id === 'INCOME')?.totalMinor || 0;
  const afterExpense = postPeriodAgg.find((r) => r._id === 'EXPENSE')?.totalMinor || 0;
  const afterNet = afterIncome - afterExpense;

  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const tx of periodTransactions) {
    if (tx.type === 'INCOME') incomeMinor += tx.baseAmountMinor;
    if (tx.type === 'EXPENSE') expenseMinor += tx.baseAmountMinor;
  }
  const netCashflowMinor = incomeMinor - expenseMinor;
  const closingBalanceMinor = currentLiquidMinor - afterNet;
  const openingBalanceMinor = closingBalanceMinor - netCashflowMinor;

  return buildMonthlyStatementPdfBuffer({
    workspace,
    monthKey,
    summary: {
      openingBalanceMinor,
      incomeMinor,
      expenseMinor,
      netCashflowMinor,
      closingBalanceMinor,
    },
    accounts,
    transactions: periodTransactions,
  });
}
