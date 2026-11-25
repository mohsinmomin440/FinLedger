import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../components/ui';

export function TeamPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const myRole = useAuthStore((s) => s.role);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');

  const canAdmin = myRole === 'OWNER' || myRole === 'ADMIN';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workspace-members', workspace?._id],
    queryFn: async () => (await api.get('/workspaces/members')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload) =>
      (await api.post('/workspaces/members/invite', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members'] });
      addToast({ title: 'Invitation dispatched', type: 'success' });
      setInviteOpen(false);
      setEmail('');
    },
    onError: (err) => {
      addToast({ title: 'Invite failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ memberId, nextRole }) =>
      (await api.patch(`/workspaces/members/${memberId}`, { role: nextRole })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members'] });
      addToast({ title: 'Role updated', type: 'success' });
    },
    onError: (err) => {
      addToast({ title: 'Role update failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId) =>
      (await api.delete(`/workspaces/members/${memberId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members'] });
      addToast({ title: 'Member removed', type: 'success' });
    },
    onError: (err) => {
      addToast({ title: 'Remove failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  if (isLoading) return <Skeleton className="h-56 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  const { members = [], invitations = [] } = data || {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Team &amp; Workspace RBAC</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-based access control: OWNER, ADMIN, MEMBER, VIEWER
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" /> Invite Member
          </Button>
        )}
      </div>

      <Card title="Active Workspace Members">
        <div className="divide-y divide-[#1F2533]">
          {members.map((m) => (
            <div key={m.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{m.user?.name}</p>
                  <p className="text-xs text-slate-400">{m.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canAdmin && m.role !== 'OWNER' ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      roleMutation.mutate({ memberId: m.id, nextRole: e.target.value })
                    }
                    className="h-8 px-2.5 rounded-lg bg-[#0B0D12] border border-[#1F2533] text-xs text-slate-200"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                ) : (
                  <Badge variant="violet">{m.role}</Badge>
                )}
                {canAdmin && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(m.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#FB7185]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {invitations.length > 0 && (
        <Card title="Pending Invitations">
          <div className="divide-y divide-[#1F2533]">
            {invitations.map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-white">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Expires {new Date(inv.expiresAt).toISOString().slice(0, 10)}
                  </p>
                </div>
                <Badge variant="amber">{inv.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate({ email, role });
          }}
          className="space-y-4"
        >
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'ADMIN', label: 'ADMIN (Manage workspace & team)' },
              { value: 'MEMBER', label: 'MEMBER (Create & edit financial records)' },
              { value: 'VIEWER', label: 'VIEWER (Read-only access)' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={inviteMutation.isPending}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
