import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { Badge, Button, Card, ErrorState, Skeleton } from '../components/ui';

export function AnalyticsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', 'report', workspace?._id, monthKey],
    queryFn: async () =>
      (await api.get('/analytics/overview', { params: { monthKey, months: 6 } })).data.data,
    enabled: Boolean(workspace?._id),
  });

  const handleDownloadStatementPdf = async () => {
    try {
      const res = await api.get('/analytics/statement/pdf', {
        params: { monthKey },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finledger-statement-${monthKey}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'Statement download failed', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await api.get('/analytics/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finledger-analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'CSV export failed', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  const pnl = data?.profitAndLoss || {};
  const aging = data?.invoiceAging || {};
  const series = (data?.monthlyCashflow || []).map((m) => ({
    monthKey: m.monthKey,
    Income: Number((m.incomeMinor / 100).toFixed(2)),
    Expense: Number((m.expenseMinor / 100).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics &amp; Financial Statements</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Profit &amp; Loss, Invoice Aging, and PDFKit Statements
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#171B25] border border-[#1F2533] text-xs text-white"
          />
          <Button variant="secondary" size="sm" onClick={handleDownloadCsv}>
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={handleDownloadStatementPdf}>
            <Download className="w-4 h-4" /> Download Monthly PDF Statement
          </Button>
        </div>
      </div>

      {/* Profit & Loss */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-slate-400">Period Revenue ({monthKey})</p>
          <p className="text-2xl font-bold text-[#10B981] tabular-nums mt-2">
            {formatMinor(pnl.incomeMinor || 0, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Period Operating Expenses ({monthKey})</p>
          <p className="text-2xl font-bold text-[#F43F5E] tabular-nums mt-2">
            {formatMinor(pnl.expenseMinor || 0, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Net Profit / Cashflow ({monthKey})</p>
          <p
            className={`text-2xl font-bold tabular-nums mt-2 ${
              (pnl.netProfitMinor || 0) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
            }`}
          >
            {formatMinor(pnl.netProfitMinor || 0, currency)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Monthly Income vs Expense">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
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
                <Bar dataKey="Income" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expense" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Invoice Aging Report" subtitle="Receivables grouped by billing status">
          <div className="space-y-3">
            {['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE', 'PAID'].map((st) => {
              const bucket = aging[st] || { count: 0, totalMinor: 0 };
              return (
                <div
                  key={st}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0B0D12] border border-[#1F2533]"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant={
                        st === 'PAID' ? 'emerald' : st === 'OVERDUE' ? 'rose' : 'violet'
                      }
                    >
                      {st}
                    </Badge>
                    <span className="text-xs text-slate-400">{bucket.count} invoices</span>
                  </div>
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {formatMinor(bucket.totalMinor, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
