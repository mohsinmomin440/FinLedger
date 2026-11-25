import { useMemo, useState } from 'react';
import {
  distributeAmount,
  formatMinor,
  parseMajorToMinor,
} from '../lib/money';
import { Badge, Button, CurrencyInput, Input, Modal, Select } from './ui';

export function SplitExpenseModal({
  open,
  onClose,
  group,
  onSubmitExpense,
  submitting = false,
}) {
  const members = useMemo(() => group?.members || [], [group]);
  const currency = group?.currency || 'INR';

  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState(members[0]?._id || '');
  const [splitType, setSplitType] = useState('EQUAL');
  const [included, setIncluded] = useState(() =>
    Object.fromEntries(members.map((m) => [m._id, true]))
  );
  const [shareInputs, setShareInputs] = useState(() =>
    Object.fromEntries(
      members.map((m, idx) => [
        m._id,
        {
          pct: idx === 0 ? String((100 / Math.max(1, members.length)).toFixed(2)) : String((100 / Math.max(1, members.length)).toFixed(2)),
          shares: '1',
          exact: '0.00',
        },
      ])
    )
  );
  const [errorMsg, setErrorMsg] = useState('');

  const effectivePaidBy = paidByMemberId || members[0]?._id || '';
  const totalMinor = parseMajorToMinor(amountInput);
  const isTotalValid = Number.isSafeInteger(totalMinor) && totalMinor > 0;

  const activeMembers = useMemo(
    () => members.filter((m) => included[m._id] !== false),
    [members, included]
  );

  const preview = useMemo(() => {
    if (!isTotalValid || activeMembers.length === 0) {
      return { valid: false, reason: 'Enter a valid positive amount', rows: [] };
    }

    if (splitType === 'EQUAL') {
      const shares = distributeAmount(totalMinor, activeMembers.length);
      return {
        valid: true,
        rows: activeMembers.map((m, i) => ({
          memberId: m._id,
          name: m.name,
          shareValue: 1,
          owedMinor: shares[i],
        })),
      };
    }

    if (splitType === 'EXACT') {
      const rows = activeMembers.map((m) => {
        const val = parseMajorToMinor(shareInputs[m._id]?.exact || '0');
        return {
          memberId: m._id,
          name: m.name,
          shareValue: Number.isSafeInteger(val) ? val : 0,
          owedMinor: Number.isSafeInteger(val) ? val : 0,
        };
      });
      const sum = rows.reduce((acc, r) => acc + r.owedMinor, 0);
      const diff = totalMinor - sum;
      return {
        valid: diff === 0,
        reason: diff !== 0 ? `Exact splits differ by ${formatMinor(Math.abs(diff), currency)}` : '',
        rows,
      };
    }

    if (splitType === 'PERCENTAGE') {
      const pcts = activeMembers.map((m) => Number(shareInputs[m._id]?.pct || 0));
      const scaledSum = pcts.reduce((acc, p) => acc + Math.round(p * 100), 0);
      if (scaledSum !== 10000) {
        return {
          valid: false,
          reason: `Percentages sum to ${(scaledSum / 100).toFixed(2)}% (must equal 100.00%)`,
          rows: activeMembers.map((m, i) => ({
            memberId: m._id,
            name: m.name,
            shareValue: pcts[i],
            owedMinor: 0,
          })),
        };
      }
      const distributed = distributeAmount(totalMinor, pcts);
      return {
        valid: true,
        rows: activeMembers.map((m, i) => ({
          memberId: m._id,
          name: m.name,
          shareValue: pcts[i],
          owedMinor: distributed[i],
        })),
      };
    }

    if (splitType === 'SHARES') {
      const weights = activeMembers.map((m) => Number(shareInputs[m._id]?.shares || 0));
      if (weights.some((w) => !Number.isFinite(w) || w <= 0)) {
        return {
          valid: false,
          reason: 'All share weights must be greater than 0',
          rows: [],
        };
      }
      const distributed = distributeAmount(totalMinor, weights);
      return {
        valid: true,
        rows: activeMembers.map((m, i) => ({
          memberId: m._id,
          name: m.name,
          shareValue: weights[i],
          owedMinor: distributed[i],
        })),
      };
    }

    return { valid: false, reason: 'Unsupported split type', rows: [] };
  }, [isTotalValid, totalMinor, activeMembers, splitType, shareInputs, currency]);

  const handleSplitTypeChange = (nextType) => {
    setSplitType(nextType);
    setErrorMsg('');
    if (nextType === 'PERCENTAGE' && activeMembers.length > 0) {
      const count = activeMembers.length;
      const baseBps = Math.floor(10000 / count);
      const rem = 10000 - baseBps * count;
      setShareInputs((prev) => {
        const next = { ...prev };
        activeMembers.forEach((m, idx) => {
          const bps = baseBps + (idx < rem ? 1 : 0);
          next[m._id] = { ...(next[m._id] || {}), pct: (bps / 100).toFixed(2) };
        });
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg('Expense title is required');
      return;
    }
    if (!preview.valid) {
      setErrorMsg(preview.reason || 'Fix split validation errors before saving');
      return;
    }

    await onSubmitExpense({
      title: title.trim(),
      paidByMemberId: effectivePaidBy,
      originalAmountMinor: totalMinor,
      originalCurrency: currency,
      splitType,
      splits: preview.rows.map((r) => ({
        memberId: r.memberId,
        shareValue: r.shareValue,
        ...(splitType === 'EXACT' ? { owedMinor: r.owedMinor } : {}),
      })),
    });

    setTitle('');
    setAmountInput('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Group Expense"
      subtitle="Penny-exact Largest Remainder allocation guarantees zero rounding drift."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Expense Title"
          required
          placeholder="e.g. Beachfront Dinner"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CurrencyInput
            label="Total Amount"
            currency={currency}
            value={amountInput}
            onChange={setAmountInput}
          />
          <Select
            label="Paid By"
            value={effectivePaidBy}
            onChange={(e) => setPaidByMemberId(e.target.value)}
            options={members.map((m) => ({ value: m._id, label: m.name }))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Split Mode</label>
          <div className="grid grid-cols-4 gap-2">
            {['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSplitTypeChange(mode)}
                className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                  splitType === mode
                    ? 'bg-[#8B7CFF]/20 border-[#8B7CFF] text-white'
                    : 'bg-[#0B0D12] border-[#1F2533] text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0D12] border border-[#1F2533] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Live Split Preview</span>
            {isTotalValid && (
              <Badge variant={preview.valid ? 'emerald' : 'rose'}>
                {preview.valid ? 'Exact Sum Validated' : preview.reason}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {members.map((m) => {
              const isIn = included[m._id] !== false;
              const row = preview.rows.find((r) => r.memberId === m._id);

              return (
                <div
                  key={m._id}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-[#1F2533]/60 last:border-0"
                >
                  <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isIn}
                      onChange={(e) =>
                        setIncluded((prev) => ({ ...prev, [m._id]: e.target.checked }))
                      }
                      className="rounded border-[#2C3447] bg-[#171B25] text-[#8B7CFF]"
                    />
                    <span>{m.name}</span>
                  </label>

                  <div className="flex items-center gap-3">
                    {isIn && splitType === 'EXACT' && (
                      <input
                        type="text"
                        aria-label={`Exact amount for ${m.name}`}
                        value={shareInputs[m._id]?.exact || '0.00'}
                        onChange={(e) =>
                          setShareInputs((prev) => ({
                            ...prev,
                            [m._id]: { ...(prev[m._id] || {}), exact: e.target.value },
                          }))
                        }
                        className="w-24 h-8 px-2 rounded-lg bg-[#171B25] border border-[#2C3447] text-xs text-right tabular-nums text-white"
                      />
                    )}
                    {isIn && splitType === 'PERCENTAGE' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          aria-label={`Percentage for ${m.name}`}
                          value={shareInputs[m._id]?.pct || '0'}
                          onChange={(e) =>
                            setShareInputs((prev) => ({
                              ...prev,
                              [m._id]: { ...(prev[m._id] || {}), pct: e.target.value },
                            }))
                          }
                          className="w-20 h-8 px-2 rounded-lg bg-[#171B25] border border-[#2C3447] text-xs text-right tabular-nums text-white"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    )}
                    {isIn && splitType === 'SHARES' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label={`Shares for ${m.name}`}
                          value={shareInputs[m._id]?.shares || '1'}
                          onChange={(e) =>
                            setShareInputs((prev) => ({
                              ...prev,
                              [m._id]: { ...(prev[m._id] || {}), shares: e.target.value },
                            }))
                          }
                          className="w-16 h-8 px-2 rounded-lg bg-[#171B25] border border-[#2C3447] text-xs text-right tabular-nums text-white"
                        />
                        <span className="text-xs text-slate-400">x</span>
                      </div>
                    )}

                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-white">
                      {isIn && row ? formatMinor(row.owedMinor, currency) : formatMinor(0, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {errorMsg && <p className="text-xs text-[#FB7185]">{errorMsg}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save Split Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
