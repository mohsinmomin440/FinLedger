import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Download, Send, XCircle } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import { formatMinor, minorToDecimalString, parseMajorToMinor } from '../lib/money';
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

export function InvoiceDetailPage() {
  const { id } = useParams();
  const workspace = useAuthStore((s) => s.activeWorkspace);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [accountId, setAccountId] = useState('');

  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices', workspace?._id, id],
    queryFn: async () => (await api.get(`/invoices/${id}`)).data.data,
    enabled: Boolean(workspace?._id && id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', workspace?._id],
    queryFn: async () => (await api.get('/accounts')).data.data,
    enabled: Boolean(workspace?._id),
  });

  const assetAccounts = accounts.filter(
    (a) => a.type === 'ASSET' && (a.subtype === 'BANK' || a.subtype === 'CASH')
  );

  const sendMutation = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/send`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      addToast({ title: 'Invoice marked as SENT & accrued in ledger', type: 'success' });
    },
    onError: (err) => addToast({ title: 'Send failed', message: getApiErrorMessage(err), type: 'error' }),
  });

  const voidMutation = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/void`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      addToast({ title: 'Invoice voided', type: 'success' });
    },
    onError: (err) => addToast({ title: 'Void failed', message: getApiErrorMessage(err), type: 'error' }),
  });

  const paymentMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/invoices/${id}/payments`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      addToast({ title: 'Payment posted to ledger', type: 'success' });
      setPayModalOpen(false);
    },
    onError: (err) => addToast({ title: 'Payment failed', message: getApiErrorMessage(err), type: 'error' }),
  });

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'PDF download failed', message: getApiErrorMessage(err), type: 'error' });
    }
  };

  if (isLoading) return <Skeleton className="h-80 rounded-2xl" />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} onRetry={refetch} />;

  const remainingMinor = Math.max(0, invoice.totalMinor - invoice.paidMinor);
  const openPayModal = () => {
    setPayAmountInput(minorToDecimalString(remainingMinor));
    setAccountId(assetAccounts.find((a) => a.subtype === 'BANK')?._id || assetAccounts[0]?._id || '');
    setPayModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            className="p-2 rounded-xl bg-[#171B25] border border-[#1F2533] text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{invoice.invoiceNumber}</h1>
              <Badge
                variant={
                  invoice.status === 'PAID'
                    ? 'emerald'
                    : invoice.status === 'OVERDUE'
                      ? 'rose'
                      : 'violet'
                }
              >
                {invoice.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {invoice.client?.name} &middot; Due {new Date(invoice.dueDate).toISOString().slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          {invoice.status === 'DRAFT' && (
            <Button
              variant="secondary"
              size="sm"
              loading={sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              <Send className="w-4 h-4" /> Mark Sent
            </Button>
          )}
          {invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
            <Button size="sm" onClick={openPayModal}>
              <CreditCard className="w-4 h-4" /> Record Payment
            </Button>
          )}
          {invoice.status !== 'VOID' && invoice.paidMinor === 0 && (
            <Button
              variant="danger"
              size="sm"
              loading={voidMutation.isPending}
              onClick={() => voidMutation.mutate()}
            >
              <XCircle className="w-4 h-4" /> Void
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-[#1F2533] text-sm">
          <div>
            <p className="text-xs uppercase text-slate-400 font-semibold mb-1">Bill To</p>
            <p className="font-semibold text-white">{invoice.client?.name}</p>
            {invoice.client?.company && <p className="text-slate-300">{invoice.client.company}</p>}
            <p className="text-slate-400 text-xs">{invoice.client?.email}</p>
          </div>
          <div className="md:text-right space-y-1 tabular-nums">
            <p className="text-xs text-slate-400">
              Issue Date: {new Date(invoice.issueDate).toISOString().slice(0, 10)}
            </p>
            <p className="text-xs text-slate-400">
              Due Date: {new Date(invoice.dueDate).toISOString().slice(0, 10)}
            </p>
            <p className="text-xs text-slate-400">Currency: {invoice.currency}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead className="border-b border-[#1F2533] text-[11px] uppercase text-slate-400">
            <tr>
              <th className="py-2 text-left">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Tax</th>
              <th className="py-2 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2533]">
            {invoice.lineItems.map((item, idx) => (
              <tr key={idx}>
                <td className="py-3 text-white">{item.description}</td>
                <td className="py-3 text-right tabular-nums text-slate-300">{item.qty}</td>
                <td className="py-3 text-right tabular-nums text-slate-300">
                  {formatMinor(item.unitPriceMinor, invoice.currency)}
                </td>
                <td className="py-3 text-right tabular-nums text-slate-400">
                  {(item.taxRateBps / 100).toFixed(2)}%
                </td>
                <td className="py-3 text-right tabular-nums font-medium text-white">
                  {formatMinor(item.lineTotalMinor, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatMinor(invoice.subtotalMinor, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax</span>
              <span>{formatMinor(invoice.taxMinor, invoice.currency)}</span>
            </div>
            {invoice.discountMinor > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Discount</span>
                <span>-{formatMinor(invoice.discountMinor, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white pt-2 border-t border-[#1F2533]">
              <span>Total</span>
              <span>{formatMinor(invoice.totalMinor, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-[#10B981]">
              <span>Paid</span>
              <span>{formatMinor(invoice.paidMinor, invoice.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-[#8B7CFF]">
              <span>Balance Due</span>
              <span>{formatMinor(remainingMinor, invoice.currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      {invoice.payments?.length > 0 && (
        <Card title="Recorded Payments">
          <div className="divide-y divide-[#1F2533] text-sm">
            {invoice.payments.map((p) => (
              <div key={p._id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">
                    {p.method} {p.reference ? `(${p.reference})` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(p.paidAt).toISOString().slice(0, 10)} &middot;{' '}
                    {p.accountId?.name || 'Deposit Account'}
                  </p>
                </div>
                <span className="font-semibold text-[#10B981] tabular-nums">
                  +{formatMinor(p.amountMinor, invoice.currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Invoice Payment">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amountMinor = parseMajorToMinor(payAmountInput);
            if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
              addToast({ title: 'Enter a valid payment amount', type: 'error' });
              return;
            }
            paymentMutation.mutate({
              amountMinor,
              method: payMethod,
              reference: payRef,
              accountId,
            });
          }}
          className="space-y-4"
        >
          <CurrencyInput
            label="Payment Amount"
            currency={invoice.currency}
            value={payAmountInput}
            onChange={setPayAmountInput}
          />
          <Select
            label="Deposit Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={assetAccounts.map((a) => ({ value: a._id, label: a.name }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Method"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              options={[
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'CARD', label: 'Card' },
                { value: 'UPI', label: 'UPI' },
                { value: 'CASH', label: 'Cash' },
              ]}
            />
            <Input
              label="Reference #"
              placeholder="UTR / Tx ID"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={paymentMutation.isPending}>
              Post Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
