import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { CURRENCIES } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { Badge, Button, Card, Input, Select } from '../components/ui';

export function SettingsPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useAuthStore((s) => s.setActiveWorkspace);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [name, setName] = useState(workspace?.name || '');
  const [type, setType] = useState(workspace?.type || 'PERSONAL');
  const [baseCurrency, setBaseCurrency] = useState(workspace?.baseCurrency || 'INR');

  const { data: sessions = [] } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => (await api.get('/auth/sessions')).data.data,
  });

  const updateWsMutation = useMutation({
    mutationFn: async (payload) => (await api.patch('/workspaces/current', payload)).data.data,
    onSuccess: (updated) => {
      setActiveWorkspace(updated);
      qc.invalidateQueries();
      addToast({ title: 'Workspace preferences updated', type: 'success' });
    },
    onError: (err) => {
      addToast({ title: 'Update failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/auth/sessions/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-sessions'] });
      addToast({ title: 'Session revoked', type: 'success' });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Workspace &amp; Security Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Base currency updates apply strictly to future entries (historical FX snapshots remain immutable)
        </p>
      </div>

      <Card title="Workspace Configuration">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateWsMutation.mutate({ name, type, baseCurrency });
          }}
          className="space-y-4"
        >
          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Workspace Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'PERSONAL', label: 'Personal' },
                { value: 'BUSINESS', label: 'Business' },
              ]}
            />
            <Select
              label="Base Currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={updateWsMutation.isPending}>
              Save Preferences
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Active Refresh Sessions" subtitle="Hashed refresh tokens with family rotation">
        <div className="divide-y divide-[#1F2533]">
          {sessions.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-white truncate max-w-md">
                      {s.userAgent}
                    </p>
                    {s.isCurrent && <Badge variant="emerald">Current</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    IP: {s.ipAddress} &middot; Expires{' '}
                    {new Date(s.expiresAt).toISOString().slice(0, 10)}
                  </p>
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(s.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#FB7185]"
                  aria-label="Revoke session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
