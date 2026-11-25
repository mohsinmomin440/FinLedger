import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor } from '../lib/money';
import { CHART_COLORS } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../components/ui';

export function DashboardPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', 'overview', workspace?._id],
    queryFn: async () => (await api.get('/analytics/overview')).data.data,
    enabled: Boolean(workspace?._id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;
  }

  const kpis = data?.kpis || {};
  const cashflowSeries = (data?.monthlyCashflow || []).map((m) => ({
    ...m,
    incomeMajor: Number((m.incomeMinor / 100).toFixed(2)),
    expenseMajor: Number((m.expenseMinor / 100).toFixed(2)),
  }));
  const categoryData = data?.categoryBreakdown || [];
  const budgets = data?.budgets || [];
  const recentTxs = data?.recentTransactions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Financial Command Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {workspace?.name} &middot; Base Currency {currency} &middot; Period {data?.monthKey}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/transactions">
            <Button size="sm">
              <Plus className="w-4 h-4" /> Record Transaction
            </Button>
          </Link>
          <Link to="/invoices/new">
            <Button variant="secondary" size="sm">
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#171B25] border border-[#1F2533] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Liquid Balance</span>
            <Wallet className="w-4 h-4 text-[#8B7CFF]" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums mt-2">
            {formatMinor(kpis.netBalanceMinor || 0, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Cash + Bank minus Credit Cards
          </p>
        </div>

        <div className="bg-[#171B25] border border-[#1F2533] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Monthly Cashflow</span>
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
          </div>
          <p
            className={`text-2xl font-bold tabular-nums mt-2 ${
              (kpis.monthlyCashflowMinor || 0) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
            }`}
          >
            {formatMinor(kpis.monthlyCashflowMinor || 0, currency)}
          </p>
          <div className="flex items-center gap-3 text-[11px] mt-1 tabular-nums">
            <span className="text-[#34D399]">
              +{formatMinor(kpis.monthlyIncomeMinor || 0, currency)}
            </span>
            <span className="text-[#FB7185]">
              -{formatMinor(kpis.monthlyExpenseMinor || 0, currency)}
            </span>
          </div>
        </div>

        <div className="bg-[#171B25] border border-[#1F2533] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Group Balances</span>
            <Users className="w-4 h-4 text-[#8B7CFF]" />
          </div>
          <div className="mt-2 space-y-1 tabular-nums">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Owed to you</span>
              <span className="font-semibold text-[#10B981]">
                {formatMinor(kpis.owedToYouMinor || 0, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">You owe</span>
              <span className="font-semibold text-[#F43F5E]">
                {formatMinor(kpis.youOweMinor || 0, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#171B25] border border-[#1F2533] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Unpaid Invoices</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums mt-2">
            {formatMinor(kpis.unpaidInvoicesMinor || 0, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {kpis.unpaidInvoicesCount || 0} open client invoices
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title="6-Month Cashflow"
          subtitle="Income vs expenses in workspace base currency"
          className="lg:col-span-2"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowSeries}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="monthKey" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#11141C',
                    borderColor: '#1F2533',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="incomeMajor"
                  name="Income"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenseMajor"
                  name="Expenses"
                  stroke="#F43F5E"
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Category Spend" subtitle={`Breakdown for ${data?.monthKey}`}>
          {categoryData.length === 0 ? (
            <EmptyState
              title="No expenses yet"
              description="Record an expense to inspect category distribution."
            />
          ) : (
            <div className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="totalMinor"
                      nameKey="category"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, idx) => (
                        <Cell key={entry.category} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatMinor(Number(value), currency)}
                      contentStyle={{
                        backgroundColor: '#11141C',
                        borderColor: '#1F2533',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-28 overflow-y-auto">
                {categoryData.map((c, idx) => (
                  <div key={c.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="text-slate-300">{c.category}</span>
                    </div>
                    <span className="tabular-nums font-medium text-white">
                      {formatMinor(c.totalMinor, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Budgets & Recent Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Budget Utilization"
          subtitle="Real-time spend vs monthly cap"
          action={
            <Link to="/budgets" className="text-xs text-[#8B7CFF] hover:underline">
              Manage
            </Link>
          }
        >
          {budgets.length === 0 ? (
            <EmptyState
              title="No budgets configured"
              description="Set category spending caps to receive automatic threshold alerts."
            />
          ) : (
            <div className="space-y-4">
              {budgets.map((b) => {
                const barColor =
                  b.status === 'EXCEEDED'
                    ? 'bg-[#F43F5E]'
                    : b.status === 'WARNING'
                      ? 'bg-amber-400'
                      : 'bg-[#10B981]';
                return (
                  <div key={b._id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{b.category}</span>
                      <span className="tabular-nums text-slate-400">
                        {formatMinor(b.spentMinor, currency)} / {formatMinor(b.limitMinor, currency)}{' '}
                        ({b.percentUsed}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#0B0D12] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Recent Ledger Feed"
          subtitle="Latest posted transactions"
          action={
            <Link to="/transactions" className="text-xs text-[#8B7CFF] hover:underline">
              View All
            </Link>
          }
        >
          {recentTxs.length === 0 ? (
            <EmptyState
              title="No ledger activity"
              description="Add your first income, expense, or account transfer."
            />
          ) : (
            <div className="divide-y divide-[#1F2533]">
              {recentTxs.map((tx) => (
                <div key={tx._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'INCOME'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : tx.type === 'EXPENSE'
                            ? 'bg-[#F43F5E]/15 text-[#F43F5E]'
                            : 'bg-[#8B7CFF]/15 text-[#8B7CFF]'
                      }`}
                    >
                      {tx.type === 'INCOME' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                      <p className="text-[11px] text-slate-400">
                        {tx.category} &middot; {tx.account?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        tx.type === 'INCOME'
                          ? 'text-[#10B981]'
                          : tx.type === 'EXPENSE'
                            ? 'text-[#F43F5E]'
                            : 'text-slate-200'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                      {formatMinor(tx.baseAmountMinor, currency)}
                    </p>
                    <Badge variant="neutral">{tx.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
