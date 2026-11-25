import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users } from 'lucide-react';
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
} from '../components/ui';

export function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const defaultCurrency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [members, setMembers] = useState([
    { name: user?.name || 'Me', email: user?.email || '' },
    { name: '', email: '' },
  ]);

  const { data: groups = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['groups', workspace?._id],
    queryFn: async () => (await api.get('/groups')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/groups', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      addToast({ title: 'Expense group created', type: 'success' });
      setModalOpen(false);
      setName('');
      setDescription('');
      setMembers([
        { name: user?.name || 'Me', email: user?.email || '' },
        { name: '', email: '' },
      ]);
    },
    onError: (err) => {
      addToast({ title: 'Failed to create group', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const handleOpenModal = () => {
    setCurrency(defaultCurrency);
    setMembers([
      { name: user?.name || 'Me', email: user?.email || '' },
      { name: '', email: '' },
    ]);
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validMembers = members.filter((m) => m.name.trim().length > 0);
    if (validMembers.length === 0) {
      addToast({ title: 'Add at least one member', type: 'error' });
      return;
    }
    createMutation.mutate({
      name,
      description,
      currency,
      members: validMembers,
    });
  };

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Expense Groups</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Split bills penny-exact and simplify debts automatically
          </p>
        </div>
        <Button size="sm" onClick={handleOpenModal}>
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No expense groups yet"
            description="Create a group for trips, shared housing, or team offsites."
            action={<Button onClick={handleOpenModal}>Create Expense Group</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((grp) => (
            <Link key={grp._id} to={`/groups/${grp._id}`} className="block">
              <Card className="h-full hover:border-[#8B7CFF]/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{grp.name}</h3>
                      <p className="text-xs text-slate-400">{grp.members.length} members</p>
                    </div>
                  </div>
                  <Badge variant="violet">{grp.currency}</Badge>
                </div>
                {grp.description && (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-2">{grp.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {grp.members.slice(0, 4).map((m) => (
                    <Badge key={m._id} variant="neutral">
                      {m.name}
                    </Badge>
                  ))}
                  {grp.members.length > 4 && (
                    <Badge variant="neutral">+{grp.members.length - 4}</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Expense Group">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Group Name"
            required
            placeholder="e.g. Goa Trip or Apartment 4B"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Description"
              placeholder="Optional note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Select
              label="Group Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Group Members</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMembers((m) => [...m, { name: '', email: '' }])}
              >
                <Plus className="w-3.5 h-3.5" /> Add Member
              </Button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder={`Member ${idx + 1} name`}
                      value={m.name}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                        )
                      }
                      className="w-full h-9 px-3 rounded-xl bg-[#0B0D12] border border-[#1F2533] text-xs text-white"
                    />
                  </div>
                  <div className="col-span-6">
                    <input
                      type="email"
                      placeholder="email (optional)"
                      value={m.email}
                      onChange={(e) =>
                        setMembers((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, email: e.target.value } : item
                          )
                        )
                      }
                      className="w-full h-9 px-3 rounded-xl bg-[#0B0D12] border border-[#1F2533] text-xs text-white"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMembers((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-[#FB7185]"
                        aria-label="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
