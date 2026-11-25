import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { CURRENCIES, formatMinor, parseMajorToMinor } from '../lib/money';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import {
  Button,
  Card,
  CurrencyInput,
  Input,
  Select,
} from '../components/ui';

export function InvoiceBuilderPage() {
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const baseCurrency = workspace?.baseCurrency || 'INR';
  const addToast = useUiStore((s) => s.addToast);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', workspace?._id],
    queryFn: async () => (await api.get('/clients')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10)
  );
  const [discountInput, setDiscountInput] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { description: '', qty: '1', unitPriceInput: '', taxPercent: '0' },
  ]);

  const effectiveClientId = clientId || clients[0]?._id || '';

  const createMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/invoices', payload)).data.data,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      addToast({ title: `Invoice ${created.invoiceNumber} created`, type: 'success' });
      navigate(`/invoices/${created._id}`);
    },
    onError: (err) => {
      addToast({ title: 'Failed to create invoice', message: getApiErrorMessage(err), type: 'error' });
    },
  });

  // Live minor-unit calculation
  let subtotalMinor = 0;
  let taxMinor = 0;
  const computedRows = lineItems.map((item) => {
    const qty = Number(item.qty || 0);
    const unitPriceMinor = parseMajorToMinor(item.unitPriceInput || '0');
    const safePrice = Number.isSafeInteger(unitPriceMinor) ? unitPriceMinor : 0;
    const taxRateBps = Math.round(Number(item.taxPercent || 0) * 100);
    const base = Math.round(qty * safePrice);
    const tax = Math.round((base * taxRateBps) / 10000);
    subtotalMinor += base;
    taxMinor += tax;
    return {
      description: item.description,
      qty,
      unitPriceMinor: safePrice,
      taxRateBps,
      lineTotalMinor: base + tax,
    };
  });

  const parsedDiscount = parseMajorToMinor(discountInput || '0');
  const discountMinor = Number.isSafeInteger(parsedDiscount) ? parsedDiscount : 0;
  const totalMinor = Math.max(0, subtotalMinor + taxMinor - discountMinor);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!effectiveClientId) {
      addToast({ title: 'Create or select a client first', type: 'error' });
      return;
    }
    createMutation.mutate({
      clientId: effectiveClientId,
      dueDate: new Date(dueDate).toISOString(),
      currency,
      discountMinor,
      notes,
      lineItems: computedRows.map((r) => ({
        description: r.description,
        qty: r.qty,
        unitPriceMinor: r.unitPriceMinor,
        taxRateBps: r.taxRateBps,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          to="/invoices"
          className="p-2 rounded-xl bg-[#171B25] border border-[#1F2533] text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">New Invoice</h1>
          <p className="text-xs text-slate-400">All line totals, tax bps &amp; discounts compute in integer minor units</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-300 mb-3">
            You need at least one client before creating an invoice.
          </p>
          <Link to="/clients">
            <Button size="sm">Create a Client</Button>
          </Link>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card title="Invoice Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Client"
                value={effectiveClientId}
                onChange={(e) => setClientId(e.target.value)}
                options={clients.map((c) => ({
                  value: c._id,
                  label: c.company ? `${c.name} (${c.company})` : c.name,
                }))}
              />
              <Select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <Input
                label="Due Date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </Card>

          <Card
            title="Line Items"
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setLineItems((items) => [
                    ...items,
                    { description: '', qty: '1', unitPriceInput: '', taxPercent: '0' },
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </Button>
            }
          >
            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#0B0D12] border border-[#1F2533]"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      label={idx === 0 ? 'Description' : undefined}
                      required
                      placeholder="Service or product"
                      value={item.description}
                      onChange={(e) =>
                        setLineItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, description: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      label={idx === 0 ? 'Qty' : undefined}
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={item.qty}
                      onChange={(e) =>
                        setLineItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, qty: e.target.value } : row))
                        )
                      }
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input
                      label={idx === 0 ? `Unit (${currency})` : undefined}
                      required
                      placeholder="100.00"
                      value={item.unitPriceInput}
                      onChange={(e) =>
                        setLineItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unitPriceInput: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      label={idx === 0 ? 'Tax %' : undefined}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.taxPercent}
                      onChange={(e) =>
                        setLineItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, taxPercent: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pb-2">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLineItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-[#FB7185]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <CurrencyInput
                  label="Discount"
                  currency={currency}
                  value={discountInput}
                  onChange={setDiscountInput}
                />
                <Input
                  label="Payment Notes"
                  placeholder="Bank transfer instructions or thank you note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D12] border border-[#1F2533] space-y-2 text-sm tabular-nums">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatMinor(subtotalMinor, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax</span>
                  <span>{formatMinor(taxMinor, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Discount</span>
                  <span>-{formatMinor(discountMinor, currency)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-[#1F2533]">
                  <span>Total</span>
                  <span>{formatMinor(totalMinor, currency)}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Link to="/invoices">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={createMutation.isPending}>
              Create Draft Invoice
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
