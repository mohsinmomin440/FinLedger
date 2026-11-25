import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import {
  Badge,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  Table,
} from '../components/ui';

export function LedgerPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';
  const [page, setPage] = useState(1);
  const [selectedJournal, setSelectedJournal] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ledger', 'journals', workspace?._id, page],
    queryFn: async () => (await api.get('/ledger/journals', { params: { page, limit: 20 } })).data,
    enabled: Boolean(workspace?._id),
  });

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (j) => (
        <span className="tabular-nums text-slate-300">
          {new Date(j.date).toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Journal Description',
      render: (j) => <span className="font-medium text-white">{j.description}</span>,
    },
    {
      key: 'referenceType',
      header: 'Reference',
      render: (j) => <Badge variant="violet">{j.referenceType}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (j) => (
        <Badge variant={j.status === 'REVERSED' ? 'amber' : 'emerald'}>{j.status}</Badge>
      ),
    },
    {
      key: 'totalMinor',
      header: 'Debits = Credits',
      align: 'right',
      render: (j) => (
        <span className="font-semibold text-white tabular-nums">
          {formatMinor(j.totalMinor, j.currency || currency)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Double-Entry General Ledger</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable audit log where SUM(Debits) === SUM(Credits) on every posting
        </p>
      </div>

      <Card>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
        ) : (
          <>
            <Table
              columns={columns}
              data={data?.data || []}
              onRowClick={setSelectedJournal}
              empty={
                <EmptyState
                  title="No ledger postings yet"
                  description="Transactions, settlements, and invoice payments appear here automatically."
                />
              }
            />
            <Pagination
              page={data?.meta?.page || 1}
              totalPages={data?.meta?.totalPages || 1}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Drawer
        open={Boolean(selectedJournal)}
        onClose={() => setSelectedJournal(null)}
        title="Journal Entry Audit"
        subtitle={selectedJournal?.description}
      >
        {selectedJournal && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#171B25] border border-[#1F2533] text-xs">
              <div>
                <p className="text-slate-400">Reference Type</p>
                <p className="font-semibold text-white mt-0.5">{selectedJournal.referenceType}</p>
              </div>
              <div>
                <p className="text-slate-400">Posting Status</p>
                <p className="font-semibold text-white mt-0.5">{selectedJournal.status}</p>
              </div>
            </div>

            <div className="border border-[#1F2533] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#171B25] text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Account</th>
                    <th className="py-2.5 px-4 text-right">Debit</th>
                    <th className="py-2.5 px-4 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2533]">
                  {selectedJournal.entries.map((e, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{e.account?.name || e.account}</p>
                        <p className="text-[11px] text-slate-400">{e.account?.type}</p>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#34D399]">
                        {e.side === 'DEBIT'
                          ? formatMinor(e.amountMinor, selectedJournal.currency)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#FB7185]">
                        {e.side === 'CREDIT'
                          ? formatMinor(e.amountMinor, selectedJournal.currency)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
