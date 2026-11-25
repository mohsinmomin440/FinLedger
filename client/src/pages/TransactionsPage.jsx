import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Edit2,
  Paperclip,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import {
  CURRENCIES,
  convertMinorWithRate,
  formatMinor,
  getDeterministicRate,
  minorToDecimalString,
  parseMajorToMinor,
} from '../lib/money';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CurrencyInput,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
} from '../components/ui';

export function TransactionsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const baseCurrency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [filters, setFilters] = useState({
    page: 1,
    type: '',
    accountId: '',
    category: '',
    q: '',
    from: '',
    to: '',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

  const [form, setForm] = useState({
    type: 'EXPENSE',
    accountId: '',
    toAccountId: '',
    category: 'Food & Dining',
    description: '',
    amountInput: '',
    originalCurrency: baseCurrency,
    manualRate: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    receiptIds: [],
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', workspace?._id],
    queryFn: async () => (await api.get('/accounts')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const paymentAccounts = accounts.filter(
    (a) => a.type === 'ASSET' || a.type === 'LIABILITY'
  );

  const {
    data: txRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['transactions', workspace?._id, filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      return (await api.get('/transactions', { params })).data;
    },
    enabled: Boolean(workspace?._id),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTx) {
        return (await api.patch(`/transactions/${editingTx._id}`, payload)).data.data;
      }
      return (await api.post('/transactions', payload)).data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      addToast({
        title: editingTx ? 'Transaction updated (reversed & reposted)' : 'Transaction posted',
        type: 'success',
      });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ title: 'Failed to save transaction', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/transactions/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      addToast({ title: 'Transaction voided with reversing entry', type: 'success' });
      setVoidTarget(null);
    },
    onError: (err) => {
      addToast({ title: 'Failed to void', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const openCreateModal = () => {
    const defaultAcc =
      paymentAccounts.find((a) => a.subtype === 'BANK') || paymentAccounts[0];
    const secondAcc =
      paymentAccounts.find((a) => a._id !== defaultAcc?._id) || paymentAccounts[0];
    setEditingTx(null);
    setForm({
      type: 'EXPENSE',
      accountId: defaultAcc?._id || '',
      toAccountId: secondAcc?._id || '',
      category: 'Food & Dining',
      description: '',
      amountInput: '',
      originalCurrency: baseCurrency,
      manualRate: '',
      occurredAt: new Date().toISOString().slice(0, 10),
      receiptIds: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setForm({
      type: tx.type,
      accountId: tx.account?._id || tx.account,
      toAccountId: tx.toAccount?._id || tx.toAccount || '',
      category: tx.category,
      description: tx.description,
      amountInput: minorToDecimalString(tx.originalAmountMinor),
      originalCurrency: tx.originalCurrency,
      manualRate: tx.rateSource === 'MANUAL_OVERRIDE' ? tx.exchangeRate : '',
      occurredAt: new Date(tx.occurredAt).toISOString().slice(0, 10),
      receiptIds: tx.receiptIds || [],
    });
    setModalOpen(true);
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'TRANSACTION');
      const res = await api.post('/receipts', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({
        ...prev,
        receiptIds: [...prev.receiptIds, res.data.data._id],
      }));
      addToast({ title: `Attached ${file.name}`, type: 'success' });
    } catch (err) {
      addToast({ title: 'Upload failed', message: getApiErrorMessage(err), type: 'error' });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const originalAmountMinor = parseMajorToMinor(form.amountInput);
    if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor <= 0) {
      addToast({ title: 'Enter a valid positive amount', type: 'error' });
      return;
    }

    saveMutation.mutate({
      type: form.type,
      accountId: form.accountId,
      toAccountId: form.type === 'TRANSFER' ? form.toAccountId : null,
      category: form.type === 'TRANSFER' ? 'Transfer' : form.category,
      description: form.description,
      originalAmountMinor,
      originalCurrency: form.originalCurrency,
      manualRate: form.manualRate || null,
      occurredAt: new Date(form.occurredAt).toISOString(),
      receiptIds: form.receiptIds,
    });
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/transactions/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finledger-transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'Export failed', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  const handleDownloadReceipt = async (receiptId) => {
    try {
      const res = await api.get(`/receipts/${receiptId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      addToast({ title: 'Could not open receipt', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  const previewMinor = parseMajorToMinor(form.amountInput);
  const effectiveRate =
    form.originalCurrency === baseCurrency
      ? '1.000000'
      : form.manualRate || getDeterministicRate(form.originalCurrency, baseCurrency);
  const previewBaseMinor =
    Number.isSafeInteger(previewMinor) && previewMinor > 0
      ? convertMinorWithRate(previewMinor, effectiveRate)
      : 0;

  const categories =
    form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const columns = [
    {
      key: 'occurredAt',
      header: 'Date',
      render: (r) => (
        <span className="text-slate-300 tabular-nums">
          {new Date(r.occurredAt).toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => (
        <div>
          <p className="font-medium text-white">{r.description}</p>
          <p className="text-xs text-slate-400">
            {r.account?.name}
            {r.toAccount ? ` → ${r.toAccount.name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => <Badge variant="neutral">{r.category}</Badge>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => (
        <Badge
          variant={
            r.type === 'INCOME' ? 'emerald' : r.type === 'EXPENSE' ? 'rose' : 'violet'
          }
        >
          {r.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <div className="text-right tabular-nums">
          <p
            className={`font-semibold ${
              r.type === 'INCOME'
                ? 'text-[#10B981]'
                : r.type === 'EXPENSE'
                  ? 'text-[#F43F5E]'
                  : 'text-slate-100'
            }`}
          >
            {r.type === 'INCOME' ? '+' : r.type === 'EXPENSE' ? '-' : ''}
            {formatMinor(r.baseAmountMinor, baseCurrency)}
          </p>
          {r.originalCurrency !== baseCurrency && (
            <p className="text-[11px] text-slate-400">
              {formatMinor(r.originalAmountMinor, r.originalCurrency)} @ {r.exchangeRate}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.receiptIds?.length > 0 && (
            <button
              type="button"
              onClick={() => handleDownloadReceipt(r.receiptIds[0])}
              title="View receipt"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1F2533]"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => openEditModal(r)}
            aria-label={`Edit ${r.description}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1F2533]"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setVoidTarget(r)}
            aria-label={`Void ${r.description}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#FB7185] hover:bg-[#F43F5E]/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Every entry posts atomically to the double-entry ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search description..."
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0B0D12] border border-[#1F2533] text-sm text-slate-100 focus:outline-none focus:border-[#8B7CFF]"
            />
          </div>
          <Select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
            options={[
              { value: '', label: 'All Types' },
              { value: 'INCOME', label: 'Income' },
              { value: 'EXPENSE', label: 'Expense' },
              { value: 'TRANSFER', label: 'Transfer' },
            ]}
          />
          <Select
            value={filters.accountId}
            onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value, page: 1 }))}
            options={[
              { value: '', label: 'All Accounts' },
              ...paymentAccounts.map((a) => ({ value: a._id, label: a.name })),
            ]}
          />
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
        ) : (
          <>
            <Table
              columns={columns}
              data={txRes?.data || []}
              empty={
                <EmptyState
                  title="No transactions found"
                  description="Record income, expenses, or account transfers to populate your ledger."
                  action={<Button onClick={openCreateModal}>Add Transaction</Button>}
                />
              }
            />
            <Pagination
              page={txRes?.meta?.page || 1}
              totalPages={txRes?.meta?.totalPages || 1}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </Card>

      {/* Add/Edit Transaction Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTx ? 'Edit Transaction' : 'Record Transaction'}
        subtitle="Creates balanced double-entry journal postings (reversing on edit)."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {['EXPENSE', 'INCOME', 'TRANSFER'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: t,
                    category: t === 'INCOME' ? 'Salary' : t === 'EXPENSE' ? 'Food & Dining' : 'Transfer',
                  }))
                }
                className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                  form.type === t
                    ? 'bg-[#8B7CFF]/20 border-[#8B7CFF] text-white'
                    : 'bg-[#0B0D12] border-[#1F2533] text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Input
            label="Description"
            required
            placeholder="e.g. AWS Cloud Bill or Client Retainer"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Amount"
              currency={form.originalCurrency}
              value={form.amountInput}
              onChange={(val) => setForm((f) => ({ ...f, amountInput: val }))}
            />
            <Select
              label="Currency"
              value={form.originalCurrency}
              onChange={(e) => setForm((f) => ({ ...f, originalCurrency: e.target.value }))}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          {form.originalCurrency !== baseCurrency && (
            <div className="p-3 rounded-xl bg-[#0B0D12] border border-[#1F2533] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Live FX Conversion ({form.originalCurrency} → {baseCurrency})</span>
                <span className="font-semibold text-[#34D399] tabular-nums">
                  {formatMinor(previewBaseMinor, baseCurrency)}
                </span>
              </div>
              <Input
                label="Manual FX Rate Override (optional)"
                placeholder={`Default: ${getDeterministicRate(form.originalCurrency, baseCurrency)}`}
                value={form.manualRate}
                onChange={(e) => setForm((f) => ({ ...f, manualRate: e.target.value }))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={form.type === 'TRANSFER' ? 'From Account' : 'Account'}
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              options={paymentAccounts.map((a) => ({ value: a._id, label: a.name }))}
            />
            {form.type === 'TRANSFER' ? (
              <Select
                label="To Account"
                value={form.toAccountId}
                onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
                options={paymentAccounts.map((a) => ({ value: a._id, label: a.name }))}
              />
            ) : (
              <Select
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Input
              label="Date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Receipt Attachment ({form.receiptIds.length})
              </label>
              <label className="h-10 px-3 rounded-xl bg-[#0B0D12] border border-dashed border-[#2C3447] hover:border-[#8B7CFF] flex items-center justify-center gap-2 text-xs text-slate-300 cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
                {uploadingReceipt ? 'Uploading...' : 'Attach PNG/JPG/PDF'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editingTx ? 'Save Changes' : 'Post Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => voidMutation.mutate(voidTarget._id)}
        loading={voidMutation.isPending}
        title="Void Transaction"
        message={`Voiding "${voidTarget?.description}" will generate an immutable reversing journal entry and restore account balances.`}
        confirmText="Void & Reverse"
      />
    </div>
  );
}
