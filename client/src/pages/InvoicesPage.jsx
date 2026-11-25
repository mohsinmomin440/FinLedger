import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  Table,
} from '../components/ui';

const STATUS_BADGE = {
  DRAFT: 'neutral',
  SENT: 'sky',
  PARTIAL: 'amber',
  PAID: 'emerald',
  OVERDUE: 'rose',
  VOID: 'neutral',
};

export function InvoicesPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const navigate = useNavigate();
  const [status, setStatus] = useState('');

  const { data: invoices = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices', workspace?._id, status],
    queryFn: async () =>
      (await api.get('/invoices', { params: status ? { status } : {} })).data.data,
    enabled: Boolean(workspace?._id),
  });

  const columns = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (inv) => <span className="font-semibold text-white">{inv.invoiceNumber}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      render: (inv) => (
        <div>
          <p className="text-slate-200">{inv.client?.name}</p>
          <p className="text-xs text-slate-400">{inv.client?.company}</p>
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (inv) => (
        <span className="tabular-nums text-slate-300">
          {new Date(inv.dueDate).toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => <Badge variant={STATUS_BADGE[inv.status] || 'neutral'}>{inv.status}</Badge>,
    },
    {
      key: 'totalMinor',
      header: 'Total',
      align: 'right',
      render: (inv) => (
        <span className="font-semibold text-white tabular-nums">
          {formatMinor(inv.totalMinor, inv.currency)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance Due',
      align: 'right',
      render: (inv) => (
        <span className="tabular-nums text-slate-300">
          {formatMinor(Math.max(0, inv.totalMinor - inv.paidMinor), inv.currency)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Invoices</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track receivables, record payments, and stream PDFKit invoices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SENT', label: 'Sent' },
              { value: 'PARTIAL', label: 'Partial' },
              { value: 'PAID', label: 'Paid' },
              { value: 'OVERDUE', label: 'Overdue' },
            ]}
          />
          <Link to="/invoices/new">
            <Button size="sm">
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <Skeleton className="h-56" />
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
        ) : (
          <Table
            columns={columns}
            data={invoices}
            onRowClick={(inv) => navigate(`/invoices/${inv._id}`)}
            empty={
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Build an itemized invoice for any client."
                action={
                  <Link to="/invoices/new">
                    <Button>Create Invoice</Button>
                  </Link>
                }
              />
            }
          />
        )}
      </Card>
    </div>
  );
}
