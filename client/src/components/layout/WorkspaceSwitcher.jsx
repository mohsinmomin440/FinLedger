import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { CURRENCIES } from '../../lib/money';
import { Button, Input, Modal, Select } from '../ui';

export function WorkspaceSwitcher() {
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const workspaces = useAuthStore((s) => s.workspaces);
  const setSession = useAuthStore((s) => s.setSession);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('BUSINESS');
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);

  const handleSwitch = async (workspaceId) => {
    try {
      const res = await api.post(`/workspaces/${workspaceId}/switch`);
      const { workspace, role } = res.data.data;
      setSession({ workspace, role });
      qc.invalidateQueries();
      addToast({ title: `Switched to ${workspace.name}`, type: 'success' });
    } catch (err) {
      addToast({ title: 'Failed to switch workspace', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/workspaces', { name, type, baseCurrency });
      const created = res.data.data;
      setSession({
        workspace: created,
        role: 'OWNER',
        workspaces: [...workspaces, created],
      });
      qc.invalidateQueries();
      addToast({ title: `Created workspace "${created.name}"`, type: 'success' });
      setCreateOpen(false);
      setName('');
    } catch (err) {
      addToast({ title: 'Failed to create workspace', message: getApiErrorMessage(err), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-[#0B0D12] border border-[#1F2533] rounded-xl px-2.5 h-9">
          <Building2 className="w-3.5 h-3.5 text-[#8B7CFF]" />
          <select
            aria-label="Active workspace"
            value={activeWorkspace?._id || ''}
            onChange={(e) => handleSwitch(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none pr-2 cursor-pointer"
          >
            {(workspaces.length > 0 ? workspaces : activeWorkspace ? [activeWorkspace] : []).map(
              (ws) => (
                <option key={ws._id} value={ws._id} className="bg-[#171B25] text-slate-100">
                  {ws.name} ({ws.baseCurrency})
                </option>
              )
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          title="New workspace"
          aria-label="Create workspace"
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#171B25] border border-[#1F2533] text-slate-300 hover:text-white hover:border-[#8B7CFF]"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Workspace"
        subtitle="Isolate personal or business ledgers with dedicated currency & RBAC."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Studio Operations"
            required
          />
          <div className="grid grid-cols-2 gap-3">
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
