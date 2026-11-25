import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { CURRENCIES, formatMinor, parseMajorToMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Badge,
  Button,
  Card,
  CurrencyInput,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../components/ui';

export function AccountsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const currency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'ASSET',
    subtype: 'BANK',
    currency,
    openingInput: '0.00',
  });

  const { data: accounts = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounts', workspace?._id],
    queryFn: async () => (await api.get('/accounts')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/accounts', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Account created', type: 'success' });
      setModalOpen(false);
      setForm({ name: '', type: 'ASSET', subtype: 'BANK', currency, openingInput: '0.00' });
    },
    onError: (err) => {
      addToast({ title: 'Could not create account', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const openingBalanceMinor = parseMajorToMinor(form.openingInput);
    createMutation.mutate({
      name: form.name,
      type: form.type,
      subtype: form.subtype,
      currency: form.currency,
      openingBalanceMinor: Number.isSafeInteger(openingBalanceMinor) ? openingBalanceMinor : 0,
    });
  };

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Chart of Accounts</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Asset, Liability, Income, Expense &amp; Equity ledger balances
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> New Account
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <Card key={acc._id} className="hover:border-[#2C3447] transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{acc.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    {acc.type} &middot; {acc.subtype}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  acc.type === 'ASSET' || acc.type === 'INCOME'
                    ? 'emerald'
                    : acc.type === 'LIABILITY' || acc.type === 'EXPENSE'
                      ? 'rose'
                      : 'violet'
                }
              >
                {acc.currency}
              </Badge>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums mt-4">
              {formatMinor(acc.balanceMinor, acc.currency)}
            </p>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Ledger Account">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Name"
            required
            placeholder="e.g. Savings Vault"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              options={[
                { value: 'ASSET', label: 'ASSET' },
                { value: 'LIABILITY', label: 'LIABILITY' },
                { value: 'INCOME', label: 'INCOME' },
                { value: 'EXPENSE', label: 'EXPENSE' },
                { value: 'EQUITY', label: 'EQUITY' },
              ]}
            />
            <Select
              label="Subtype"
              value={form.subtype}
              onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))}
              options={[
                { value: 'BANK', label: 'BANK' },
                { value: 'CASH', label: 'CASH' },
                { value: 'CARD', label: 'CARD' },
                { value: 'RECEIVABLE', label: 'RECEIVABLE' },
                { value: 'PAYABLE', label: 'PAYABLE' },
                { value: 'OPERATING', label: 'OPERATING' },
                { value: 'EQUITY', label: 'EQUITY' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <CurrencyInput
              label="Opening Balance"
              currency={form.currency}
              value={form.openingInput}
              onChange={(val) => setForm((f) => ({ ...f, openingInput: val }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
