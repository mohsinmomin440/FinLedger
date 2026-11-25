import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { SplitExpenseModal } from '../components/SplitExpenseModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
} from '../components/ui';

export function GroupDetailPage() {
  const { id } = useParams();
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [settleNote, setSettleNote] = useState('Settled up');
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '' });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['groups', workspace?._id, id],
    queryFn: async () => (await api.get(`/groups/${id}/balances`)).data.data,
    enabled: Boolean(workspace?._id && id),
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/groups/${id}/expenses`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Group expense added', type: 'success' });
      setExpenseModalOpen(false);
    },
    onError: (err) => {
      addToast({ title: 'Failed to add expense', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId) =>
      (await api.delete(`/groups/${id}/expenses/${expenseId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Expense deleted', type: 'success' });
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/groups/${id}/settlements`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Debt settled in double-entry ledger', type: 'success' });
      setSettleTarget(null);
    },
    onError: (err) => {
      addToast({ title: 'Settlement failed', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/groups/${id}/members`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      addToast({ title: 'Member added', type: 'success' });
      setMemberModalOpen(false);
      setNewMember({ name: '', email: '' });
    },
  });

  if (isLoading) return <Skeleton className="h-80 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  const {
    group,
    expenses = [],
    settlements = [],
    memberBalances = [],
    simplifiedDebts = [],
    totalSpendMinor = 0,
  } = data || {};
  const currency = group?.currency || 'INR';

  const memberNameMap = new Map((group?.members || []).map((m) => [m._id, m.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/groups"
            className="p-2 rounded-xl bg-[#171B25] border border-[#1F2533] text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{group?.name}</h1>
              <Badge variant="violet">{currency}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Total Group Spend:{' '}
              <strong className="text-white tabular-nums">
                {formatMinor(totalSpendMinor, currency)}
              </strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMemberModalOpen(true)}>
            Add Member
          </Button>
          <Button size="sm" onClick={() => setExpenseModalOpen(true)}>
            <Plus className="w-4 h-4" /> Split Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Member Balances */}
        <Card title="Member Net Balances" subtitle="Zero-sum verified across expenses & settlements">
          <div className="space-y-3">
            {memberBalances.map((mb) => (
              <div
                key={mb.memberId}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0B0D12] border border-[#1F2533]"
              >
                <div>
                  <p className="text-sm font-medium text-white">{mb.name}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    Paid {formatMinor(mb.paidMinor, currency)} &middot; Share{' '}
                    {formatMinor(mb.owedMinor, currency)}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    mb.balanceMinor > 0
                      ? 'text-[#10B981]'
                      : mb.balanceMinor < 0
                        ? 'text-[#F43F5E]'
                        : 'text-slate-400'
                  }`}
                >
                  {mb.balanceMinor > 0 ? '+' : ''}
                  {formatMinor(mb.balanceMinor, currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Simplified Debts */}
        <Card
          title="Simplified Debts"
          subtitle="Minimum cash-flow settlement plan"
        >
          {simplifiedDebts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All settled up!"
              description="Every member in this group has a zero net balance."
            />
          ) : (
            <div className="space-y-3">
              {simplifiedDebts.map((debt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0B0D12] border border-[#1F2533]"
                >
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <span className="font-semibold text-[#FB7185] truncate">
                      {debt.fromName || memberNameMap.get(debt.fromMemberId)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-semibold text-[#34D399] truncate">
                      {debt.toName || memberNameMap.get(debt.toMemberId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-white tabular-nums">
                      {formatMinor(debt.amountMinor, currency)}
                    </span>
                    <Button
                      size="sm"
                      variant="emerald"
                      onClick={() => setSettleTarget(debt)}
                    >
                      Settle Up
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Group Timeline */}
      <Card title="Group Expenses & Settlements">
        {expenses.length === 0 && settlements.length === 0 ? (
          <EmptyState
            title="No group expenses yet"
            description="Click Split Expense to record a shared expense."
          />
        ) : (
          <div className="divide-y divide-[#1F2533]">
            {expenses.map((exp) => (
              <div key={exp._id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{exp.title}</span>
                    <Badge variant="violet">{exp.splitType}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paid by <strong>{memberNameMap.get(exp.paidByMemberId)}</strong> &middot;{' '}
                    {new Date(exp.occurredAt).toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white tabular-nums">
                    {formatMinor(
                      exp.splits.reduce((a, s) => a + s.owedMinor, 0),
                      currency
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExpenseMutation.mutate(exp._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#FB7185]"
                    aria-label={`Delete ${exp.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {settlements.map((st) => (
              <div key={st._id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="emerald">SETTLEMENT</Badge>
                    <span className="text-sm text-slate-200">
                      {memberNameMap.get(st.fromMemberId)} paid {memberNameMap.get(st.toMemberId)}
                    </span>
                  </div>
                  {st.note && <p className="text-xs text-slate-400 mt-0.5">{st.note}</p>}
                </div>
                <span className="text-sm font-semibold text-[#10B981] tabular-nums">
                  {formatMinor(st.amountMinor, st.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SplitExpenseModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        group={group}
        onSubmitExpense={(payload) => addExpenseMutation.mutateAsync(payload)}
        submitting={addExpenseMutation.isPending}
      />

      {/* 1-Click Settle Up Confirmation Modal */}
      <Modal
        open={Boolean(settleTarget)}
        onClose={() => setSettleTarget(null)}
        title="Confirm Settlement"
        subtitle="Posts an ACID settlement record and double-entry ledger journal."
        maxWidth="max-w-md"
      >
        {settleTarget && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0B0D12] border border-[#1F2533] text-center space-y-1">
              <p className="text-xs text-slate-400">
                {settleTarget.fromName || memberNameMap.get(settleTarget.fromMemberId)} →{' '}
                {settleTarget.toName || memberNameMap.get(settleTarget.toMemberId)}
              </p>
              <p className="text-2xl font-bold text-[#10B981] tabular-nums">
                {formatMinor(settleTarget.amountMinor, currency)}
              </p>
            </div>
            <Input
              label="Settlement Note"
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSettleTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="emerald"
                loading={settleMutation.isPending}
                onClick={() =>
                  settleMutation.mutate({
                    fromMemberId: settleTarget.fromMemberId,
                    toMemberId: settleTarget.toMemberId,
                    amountMinor: settleTarget.amountMinor,
                    currency,
                    note: settleNote,
                  })
                }
              >
                Confirm Settlement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title="Add Member to Group"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMemberMutation.mutate(newMember);
          }}
          className="space-y-4"
        >
          <Input
            label="Member Name"
            required
            value={newMember.name}
            onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))}
          />
          <Input
            label="Email (optional)"
            type="email"
            value={newMember.email}
            onChange={(e) => setNewMember((m) => ({ ...m, email: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMemberModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addMemberMutation.isPending}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
