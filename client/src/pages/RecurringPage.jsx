import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/constants';
import { formatMinor, parseMajorToMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CurrencyInput,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../components/ui';

export function RecurringPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    kind: 'TRANSACTION',
    frequency: 'MONTHLY',
    nextRunAt: new Date().toISOString().slice(0, 10),
    txType: 'EXPENSE',
    accountId: '',
    category: 'Software & SaaS',
    description: '',
    amountInput: '',
    clientId: '',
    unitPriceInput: '',
  });

  const { data: rules = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recurring', workspace?._id],
    queryFn: async () => (await api.get('/recurring')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', workspace?._id],
    queryFn: async () => (await api.get('/accounts')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', workspace?._id],
    queryFn: async () => (await api.get('/clients')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const paymentAccounts = accounts.filter((a) => a.type === 'ASSET' || a.type === 'LIABILITY');

  const createMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/recurring', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      addToast({ title: 'Recurring rule scheduled', type: 'success' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ title: 'Failed to save rule', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/recurring/${id}/trigger`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      addToast({ title: 'Recurring rule executed', type: 'success' });
    },
    onError: (err) => {
      addToast({ title: 'Trigger failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/recurring/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      addToast({ title: 'Rule deleted', type: 'success' });
    },
  });

  const handleOpenModal = () => {
    setForm((prev) => ({
      ...prev,
      accountId: paymentAccounts.find((a) => a.subtype === 'BANK')?._id || paymentAccounts[0]?._id || '',
      clientId: clients[0]?._id || '',
    }));
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let templatePayload;
    if (form.kind === 'TRANSACTION') {
      const minor = parseMajorToMinor(form.amountInput);
      if (!Number.isSafeInteger(minor) || minor <= 0) {
        addToast({ title: 'Enter a valid amount', type: 'error' });
        return;
      }
      templatePayload = {
        type: form.txType,
        accountId: form.accountId,
        category: form.category,
        description: form.description || form.name,
        originalAmountMinor: minor,
        originalCurrency: currency,
      };
    } else {
      const minor = parseMajorToMinor(form.unitPriceInput);
      if (!form.clientId || !Number.isSafeInteger(minor) || minor <= 0) {
        addToast({ title: 'Select a client and enter a valid retainer amount', type: 'error' });
        return;
      }
      templatePayload = {
        clientId: form.clientId,
        currency,
        dueDays: 14,
        autoSend: true,
        lineItems: [{ description: form.description || form.name, qty: 1, unitPriceMinor: minor, taxRateBps: 0 }],
      };
    }

    createMutation.mutate({
      name: form.name,
      kind: form.kind,
      frequency: form.frequency,
      nextRunAt: new Date(form.nextRunAt).toISOString(),
      templatePayload,
    });
  };

  if (isLoading) return <Skeleton className="h-56 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Recurring Bills &amp; Retainers</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Idempotent scheduler with atomic nextRunAt locking
          </p>
        </div>
        <Button size="sm" onClick={handleOpenModal}>
          <Plus className="w-4 h-4" /> New Recurring Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No recurring schedules"
            description="Automate monthly subscriptions, rent, or retainer invoices."
            action={<Button onClick={handleOpenModal}>Create Recurring Rule</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((r) => {
            const amount =
              r.kind === 'TRANSACTION'
                ? r.templatePayload?.originalAmountMinor || 0
                : r.templatePayload?.lineItems?.[0]?.unitPriceMinor || 0;
            return (
              <Card key={r._id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                      <Badge variant="violet">{r.kind}</Badge>
                      <Badge variant="sky">{r.frequency}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Next run: {new Date(r.nextRunAt).toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <span className="text-base font-bold text-white tabular-nums">
                    {formatMinor(amount, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#1F2533]">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={triggerMutation.isPending}
                    onClick={() => triggerMutation.mutate(r._id)}
                  >
                    <Play className="w-3.5 h-3.5" /> Run Now
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(r._id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-[#FB7185]"
                    aria-label={`Delete ${r.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Recurring Rule">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Rule Name"
            required
            placeholder="e.g. Cloud Hosting or Monthly Retainer"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Kind"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              options={[
                { value: 'TRANSACTION', label: 'Transaction' },
                { value: 'INVOICE', label: 'Invoice' },
              ]}
            />
            <Select
              label="Frequency"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              options={[
                { value: 'WEEKLY', label: 'Weekly' },
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
            />
            <Input
              label="Next Run"
              type="date"
              required
              value={form.nextRunAt}
              onChange={(e) => setForm((f) => ({ ...f, nextRunAt: e.target.value }))}
            />
          </div>

          {form.kind === 'TRANSACTION' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Type"
                  value={form.txType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      txType: e.target.value,
                      category: e.target.value === 'INCOME' ? 'Salary' : 'Software & SaaS',
                    }))
                  }
                  options={[
                    { value: 'EXPENSE', label: 'Expense' },
                    { value: 'INCOME', label: 'Income' },
                  ]}
                />
                <Select
                  label="Account"
                  value={form.accountId}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                  options={paymentAccounts.map((a) => ({ value: a._id, label: a.name }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  options={(form.txType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                    (c) => ({ value: c, label: c })
                  )}
                />
                <CurrencyInput
                  label="Amount"
                  currency={currency}
                  value={form.amountInput}
                  onChange={(val) => setForm((f) => ({ ...f, amountInput: val }))}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Client"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                options={clients.map((c) => ({ value: c._id, label: c.name }))}
              />
              <CurrencyInput
                label="Retainer Fee"
                currency={currency}
                value={form.unitPriceInput}
                onChange={(val) => setForm((f) => ({ ...f, unitPriceInput: val }))}
              />
            </div>
          )}

          <Input
            label="Line / Entry Description"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Schedule Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
