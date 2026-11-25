import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { CURRENCIES } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
} from '../components/ui';

export function ClientsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const defaultCurrency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    billingAddress: '',
    taxId: '',
    defaultCurrency,
  });

  const { data: clients = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clients', workspace?._id],
    queryFn: async () => (await api.get('/clients')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/clients', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast({ title: 'Client added', type: 'success' });
      setModalOpen(false);
      setForm({
        name: '',
        email: '',
        company: '',
        phone: '',
        billingAddress: '',
        taxId: '',
        defaultCurrency,
      });
    },
    onError: (err) => {
      addToast({ title: 'Failed to create client', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/clients/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast({ title: 'Client deleted', type: 'success' });
    },
    onError: (err) => {
      addToast({ title: 'Cannot delete client', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Client',
      render: (c) => (
        <div>
          <p className="font-medium text-white">{c.name}</p>
          <p className="text-xs text-slate-400">{c.company || 'Individual'}</p>
        </div>
      ),
    },
    { key: 'email', header: 'Email' },
    {
      key: 'defaultCurrency',
      header: 'Currency',
      render: (c) => <Badge variant="violet">{c.defaultCurrency}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <button
          type="button"
          onClick={() => deleteMutation.mutate(c._id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#FB7185]"
          aria-label={`Delete ${c.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Clients</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage billing contacts &amp; tax profiles</p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add Client
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />
        ) : (
          <Table
            columns={columns}
            data={clients}
            empty={
              <EmptyState
                icon={Briefcase}
                title="No clients yet"
                description="Create your first client to start issuing PDF invoices."
                action={<Button onClick={() => setModalOpen(true)}>Add Client</Button>}
              />
            }
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Client">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
            <Select
              label="Billing Currency"
              value={form.defaultCurrency}
              onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Tax ID / GSTIN"
              value={form.taxId}
              onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            />
          </div>
          <Input
            label="Billing Address"
            value={form.billingAddress}
            onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Save Client
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
