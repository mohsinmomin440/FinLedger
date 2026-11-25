import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { EXPENSE_CATEGORIES } from '../lib/constants';
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

export function BudgetsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    limitInput: '',
    alertThresholdPercent: 80,
  });

  const { data: budgets = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['budgets', workspace?._id, monthKey],
    queryFn: async () => (await api.get('/budgets', { params: { monthKey } })).data.data,
    enabled: Boolean(workspace?._id),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/budgets', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Budget saved', type: 'success' });
      setModalOpen(false);
    },
    onError: (err) => {
      addToast({ title: 'Failed to save budget', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/budgets/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      addToast({ title: 'Budget removed', type: 'success' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const limitMinor = parseMajorToMinor(form.limitInput);
    if (!Number.isSafeInteger(limitMinor) || limitMinor <= 0) {
      addToast({ title: 'Enter a valid budget limit', type: 'error' });
      return;
    }
    saveMutation.mutate({
      category: form.category,
      monthKey,
      limitMinor,
      alertThresholdPercent: Number(form.alertThresholdPercent),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Monthly Budgets</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track category caps with automatic 80% warning &amp; 100% exceeded alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#171B25] border border-[#1F2533] text-xs text-white"
          />
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" /> Set Budget
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
      ) : budgets.length === 0 ? (
        <Card>
          <EmptyState
            title={`No budgets for ${monthKey}`}
            description="Create a monthly spending limit for any expense category."
            action={<Button onClick={() => setModalOpen(true)}>Set Budget</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const barClass =
              b.status === 'EXCEEDED'
                ? 'bg-[#F43F5E]'
                : b.status === 'WARNING'
                  ? 'bg-amber-400'
                  : 'bg-[#10B981]';
            return (
              <Card key={b._id}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{b.category}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Alert at {b.alertThresholdPercent}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        b.status === 'EXCEEDED'
                          ? 'rose'
                          : b.status === 'WARNING'
                            ? 'amber'
                            : 'emerald'
                      }
                    >
                      {b.status} ({b.percentUsed}%)
                    </Badge>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(b._id)}
                      className="p-1 text-slate-400 hover:text-[#FB7185]"
                      aria-label={`Delete ${b.category} budget`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-2.5 rounded-full bg-[#0B0D12] overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${barClass}`}
                    style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-slate-300">
                    Spent: <strong>{formatMinor(b.spentMinor, currency)}</strong>
                  </span>
                  <span className="text-slate-400">
                    Cap: <strong>{formatMinor(b.limitMinor, currency)}</strong>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Configure Monthly Budget">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Expense Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <CurrencyInput
            label="Monthly Limit"
            currency={currency}
            value={form.limitInput}
            onChange={(val) => setForm((f) => ({ ...f, limitInput: val }))}
          />
          <Input
            label="Alert Threshold (%)"
            type="number"
            min={1}
            max={100}
            value={form.alertThresholdPercent}
            onChange={(e) => setForm((f) => ({ ...f, alertThresholdPercent: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              Save Budget
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
