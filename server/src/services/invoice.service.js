import { Account, Client, Invoice } from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import {
  applyBps,
  convertMinorWithRate,
  formatMinor,
  resolveFxConversion,
} from '../utils/money.js';
import {
  findSystemAccount,
  postJournalEntry,
  reverseJournalEntry,
} from './ledger.service.js';
import {
  createActivity,
  createWorkspaceNotifications,
  emitWorkspaceEvent,
} from './notification.service.js';

export function computeInvoiceAmounts(lineItems, discountMinor = 0) {
  let subtotalMinor = 0;
  let taxMinor = 0;

  const computedItems = lineItems.map((item) => {
    const qtyMilli = BigInt(Math.round(Number(item.qty) * 1000));
    if (qtyMilli <= 0n) {
      throw ApiError.badRequest('Line item quantity must be positive', 'INVALID_QTY');
    }
    const lineBaseMinor = Number((BigInt(item.unitPriceMinor) * qtyMilli + 500n) / 1000n);
    const taxRateBps = item.taxRateBps ?? 0;
    const lineTaxMinor = applyBps(lineBaseMinor, taxRateBps);
    const lineTotalMinor = lineBaseMinor + lineTaxMinor;

    subtotalMinor += lineBaseMinor;
    taxMinor += lineTaxMinor;

    return {
      description: item.description.trim(),
      qty: Number(item.qty),
      unitPriceMinor: item.unitPriceMinor,
      taxRateBps,
      lineTotalMinor,
    };
  });

  const grossTotal = subtotalMinor + taxMinor;
  if (discountMinor > grossTotal) {
    throw ApiError.badRequest('Discount cannot exceed invoice gross total', 'INVALID_DISCOUNT');
  }

  return {
    lineItems: computedItems,
    subtotalMinor,
    taxMinor,
    discountMinor,
    totalMinor: grossTotal - discountMinor,
  };
}

async function generateInvoiceNumber(workspaceId) {
  const count = await Invoice.countDocuments({ workspace: workspaceId });
  const seq = String(count + 1).padStart(4, '0');
  const year = new Date().getUTCFullYear();
  return `INV-${year}-${seq}`;
}

export async function createClient({ workspaceId, payload }) {
  return Client.create({
    workspace: workspaceId,
    name: payload.name.trim(),
    email: payload.email.toLowerCase().trim(),
    phone: (payload.phone || '').trim(),
    company: (payload.company || '').trim(),
    billingAddress: (payload.billingAddress || '').trim(),
    taxId: (payload.taxId || '').trim(),
    defaultCurrency: payload.defaultCurrency || 'INR',
  });
}

export async function listClients({ workspaceId }) {
  return Client.find({ workspace: workspaceId }).sort({ createdAt: -1 });
}

export async function updateClient({ workspaceId, clientId, payload }) {
  const updated = await Client.findOneAndUpdate(
    { _id: clientId, workspace: workspaceId },
    { $set: payload },
    { new: true, runValidators: true }
  );
  if (!updated) throw ApiError.notFound('Client not found', 'CLIENT_NOT_FOUND');
  return updated;
}

export async function deleteClient({ workspaceId, clientId }) {
  const existingInvoices = await Invoice.countDocuments({ workspace: workspaceId, client: clientId });
  if (existingInvoices > 0) {
    throw ApiError.conflict(
      'Cannot delete a client with existing invoices',
      'CLIENT_HAS_INVOICES'
    );
  }
  const deleted = await Client.findOneAndDelete({ _id: clientId, workspace: workspaceId });
  if (!deleted) throw ApiError.notFound('Client not found', 'CLIENT_NOT_FOUND');
  return { deleted: true };
}

export async function createInvoice({ workspace, actorId, payload }) {
  const client = await Client.findOne({ _id: payload.clientId, workspace: workspace._id });
  if (!client) {
    throw ApiError.badRequest('Client not found in workspace', 'CLIENT_NOT_FOUND');
  }

  const currency = payload.currency || client.defaultCurrency || workspace.baseCurrency;
  const computed = computeInvoiceAmounts(payload.lineItems, payload.discountMinor || 0);
  const fx = resolveFxConversion({
    amountMinor: computed.totalMinor,
    originalCurrency: currency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  const invoiceNumber =
    payload.invoiceNumber?.trim() || (await generateInvoiceNumber(workspace._id));

  const invoice = await Invoice.create({
    workspace: workspace._id,
    client: client._id,
    invoiceNumber,
    status: 'DRAFT',
    issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
    dueDate: new Date(payload.dueDate),
    currency,
    exchangeRate: fx.exchangeRate,
    rateSource: fx.rateSource,
    lineItems: computed.lineItems,
    subtotalMinor: computed.subtotalMinor,
    taxMinor: computed.taxMinor,
    discountMinor: computed.discountMinor,
    totalMinor: computed.totalMinor,
    baseTotalMinor: fx.baseAmountMinor,
    paidMinor: 0,
    payments: [],
    notes: (payload.notes || '').trim(),
    recurringRuleId: payload.recurringRuleId || null,
    createdBy: actorId,
  });

  return Invoice.findById(invoice._id).populate('client');
}

export async function listInvoices({ workspaceId, query = {} }) {
  const filter = { workspace: workspaceId };
  if (query.status) filter.status = query.status;
  if (query.clientId) filter.client = query.clientId;

  const invoices = await Invoice.find(filter)
    .sort({ issueDate: -1, createdAt: -1 })
    .populate('client', 'name company email');

  // Auto-detect overdue status dynamically on read for unpaid SENT/PARTIAL invoices past dueDate
  const now = new Date();
  for (const inv of invoices) {
    if ((inv.status === 'SENT' || inv.status === 'PARTIAL') && inv.dueDate < now && inv.paidMinor < inv.totalMinor) {
      inv.status = 'OVERDUE';
      await inv.save();
    }
  }

  return invoices;
}

export async function getInvoiceById({ workspaceId, invoiceId }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, workspace: workspaceId })
    .populate('client')
    .populate('payments.accountId', 'name type subtype currency');
  if (!invoice) {
    throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
  }
  return invoice;
}

export async function updateInvoice({ workspace, invoiceId, payload }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, workspace: workspace._id });
  if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
  if (invoice.status !== 'DRAFT') {
    throw ApiError.badRequest('Only DRAFT invoices can be edited directly', 'INVOICE_NOT_DRAFT');
  }

  const currency = payload.currency || invoice.currency;
  const lineItems = payload.lineItems || invoice.lineItems;
  const discountMinor = payload.discountMinor ?? invoice.discountMinor;
  const computed = computeInvoiceAmounts(lineItems, discountMinor);

  const fx = resolveFxConversion({
    amountMinor: computed.totalMinor,
    originalCurrency: currency,
    baseCurrency: workspace.baseCurrency,
    manualRate: payload.manualRate,
  });

  if (payload.clientId) {
    const client = await Client.findOne({ _id: payload.clientId, workspace: workspace._id });
    if (!client) throw ApiError.badRequest('Client not found in workspace', 'CLIENT_NOT_FOUND');
    invoice.client = client._id;
  }

  invoice.currency = currency;
  invoice.exchangeRate = fx.exchangeRate;
  invoice.rateSource = fx.rateSource;
  invoice.lineItems = computed.lineItems;
  invoice.subtotalMinor = computed.subtotalMinor;
  invoice.taxMinor = computed.taxMinor;
  invoice.discountMinor = computed.discountMinor;
  invoice.totalMinor = computed.totalMinor;
  invoice.baseTotalMinor = fx.baseAmountMinor;
  if (payload.issueDate) invoice.issueDate = new Date(payload.issueDate);
  if (payload.dueDate) invoice.dueDate = new Date(payload.dueDate);
  if (payload.notes !== undefined) invoice.notes = payload.notes.trim();

  await invoice.save();
  return getInvoiceById({ workspaceId: workspace._id, invoiceId: invoice._id });
}

async function accrueInvoiceInLedger({ workspace, invoice, actorId }, session) {
  if (invoice.accrualJournalId || invoice.baseTotalMinor <= 0) return invoice.accrualJournalId;

  const [arAccount, incomeAccount] = await Promise.all([
    findSystemAccount(workspace._id, { type: 'ASSET', subtype: 'RECEIVABLE' }, session),
    findSystemAccount(workspace._id, { type: 'INCOME', subtype: 'OPERATING' }, session),
  ]);

  const journal = await postJournalEntry(
    {
      workspaceId: workspace._id,
      referenceType: 'INVOICE_ACCRUAL',
      referenceId: invoice._id,
      description: `Invoice ${invoice.invoiceNumber} issued`,
      date: invoice.issueDate,
      currency: workspace.baseCurrency,
      entries: [
        { account: arAccount._id, side: 'DEBIT', amountMinor: invoice.baseTotalMinor },
        { account: incomeAccount._id, side: 'CREDIT', amountMinor: invoice.baseTotalMinor },
      ],
      createdBy: actorId,
    },
    session
  );

  invoice.accrualJournalId = journal._id;
  return journal._id;
}

export async function sendInvoice({ workspace, actorId, invoiceId }) {
  const updated = await runInTransaction(async (session) => {
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      workspace: workspace._id,
    }).session(session || null);
    if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (invoice.status !== 'DRAFT') {
      throw ApiError.badRequest('Only DRAFT invoices can be sent', 'INVALID_INVOICE_TRANSITION');
    }

    await accrueInvoiceInLedger({ workspace, invoice, actorId }, session);
    invoice.status = invoice.dueDate < new Date() ? 'OVERDUE' : 'SENT';
    await invoice.save(sessionOptions(session));

    await createActivity(
      {
        workspaceId: workspace._id,
        actorId,
        type: 'INVOICE_SENT',
        title: 'Invoice sent',
        message: `Sent ${invoice.invoiceNumber}`,
        entityType: 'INVOICE',
        entityId: invoice._id,
      },
      session
    );

    return invoice;
  });

  return getInvoiceById({ workspaceId: workspace._id, invoiceId: updated._id });
}

export async function voidInvoice({ workspace, actorId, invoiceId }) {
  const updated = await runInTransaction(async (session) => {
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      workspace: workspace._id,
    }).session(session || null);
    if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (invoice.status === 'VOID') {
      throw ApiError.conflict('Invoice is already voided', 'ALREADY_VOID');
    }
    if (invoice.paidMinor > 0) {
      throw ApiError.badRequest(
        'Cannot void an invoice with recorded payments',
        'INVOICE_HAS_PAYMENTS'
      );
    }

    if (invoice.accrualJournalId) {
      await reverseJournalEntry(
        {
          workspaceId: workspace._id,
          journalId: invoice.accrualJournalId,
          description: `Void invoice ${invoice.invoiceNumber}`,
          createdBy: actorId,
        },
        session
      );
    }

    invoice.status = 'VOID';
    await invoice.save(sessionOptions(session));

    await createActivity(
      {
        workspaceId: workspace._id,
        actorId,
        type: 'INVOICE_VOIDED',
        title: 'Invoice voided',
        message: `Voided ${invoice.invoiceNumber}`,
        entityType: 'INVOICE',
        entityId: invoice._id,
      },
      session
    );

    return invoice;
  });

  return getInvoiceById({ workspaceId: workspace._id, invoiceId: updated._id });
}

export async function recordInvoicePayment({ workspace, actorId, invoiceId, payload }) {
  const result = await runInTransaction(async (session) => {
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      workspace: workspace._id,
    }).session(session || null);
    if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

    if (invoice.status === 'VOID') {
      throw ApiError.badRequest('Cannot pay a voided invoice', 'INVOICE_VOID');
    }
    if (invoice.status === 'PAID' || invoice.paidMinor >= invoice.totalMinor) {
      throw ApiError.badRequest('Invoice is already fully paid', 'INVOICE_ALREADY_PAID');
    }

    const remainingMinor = invoice.totalMinor - invoice.paidMinor;
    if (payload.amountMinor > remainingMinor) {
      throw ApiError.badRequest(
        `Payment (${payload.amountMinor}) exceeds remaining balance (${remainingMinor})`,
        'OVERPAYMENT_NOT_ALLOWED'
      );
    }

    let depositAccount;
    if (payload.accountId) {
      depositAccount = await Account.findOne({
        _id: payload.accountId,
        workspace: workspace._id,
        archived: false,
      }).session(session || null);
      if (!depositAccount) {
        throw ApiError.badRequest('Deposit account not found in workspace', 'ACCOUNT_NOT_FOUND');
      }
    } else {
      depositAccount = await findSystemAccount(
        workspace._id,
        { type: 'ASSET', subtype: 'BANK' },
        session
      );
    }

    if (!invoice.accrualJournalId) {
      await accrueInvoiceInLedger({ workspace, invoice, actorId }, session);
    }

    const previouslyPaidBaseMinor = invoice.payments.reduce(
      (acc, p) => acc + (p.baseAmountMinor || 0),
      0
    );
    const isFinalPayment = invoice.paidMinor + payload.amountMinor === invoice.totalMinor;
    const paymentBaseMinor = isFinalPayment
      ? Math.max(1, invoice.baseTotalMinor - previouslyPaidBaseMinor)
      : Math.max(1, convertMinorWithRate(payload.amountMinor, invoice.exchangeRate));

    const arAccount = await findSystemAccount(
      workspace._id,
      { type: 'ASSET', subtype: 'RECEIVABLE' },
      session
    );

    const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
    const journal = await postJournalEntry(
      {
        workspaceId: workspace._id,
        referenceType: 'INVOICE_PAYMENT',
        referenceId: invoice._id,
        description: `Payment for ${invoice.invoiceNumber}`,
        date: paidAt,
        currency: workspace.baseCurrency,
        entries: [
          { account: depositAccount._id, side: 'DEBIT', amountMinor: paymentBaseMinor },
          { account: arAccount._id, side: 'CREDIT', amountMinor: paymentBaseMinor },
        ],
        createdBy: actorId,
      },
      session
    );

    invoice.payments.push({
      amountMinor: payload.amountMinor,
      baseAmountMinor: paymentBaseMinor,
      paidAt,
      method: payload.method || 'BANK_TRANSFER',
      reference: (payload.reference || '').trim(),
      accountId: depositAccount._id,
      ledgerJournalId: journal._id,
    });
    invoice.paidMinor += payload.amountMinor;
    invoice.status = invoice.paidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIAL';

    await invoice.save(sessionOptions(session));

    const formatted = formatMinor(payload.amountMinor, invoice.currency);
    await createActivity(
      {
        workspaceId: workspace._id,
        actorId,
        type: 'INVOICE_PAID',
        title: `Invoice payment recorded`,
        message: `Received ${formatted} for ${invoice.invoiceNumber}`,
        entityType: 'INVOICE',
        entityId: invoice._id,
      },
      session
    );

    await createWorkspaceNotifications(
      {
        workspaceId: workspace._id,
        type: 'INVOICE_PAID',
        title: `Payment received: ${invoice.invoiceNumber}`,
        message: `Recorded ${formatted} payment (${invoice.status}).`,
        metadata: { invoiceId: String(invoice._id), status: invoice.status },
      },
      session
    );

    return invoice;
  });

  const populated = await getInvoiceById({ workspaceId: workspace._id, invoiceId: result._id });
  emitWorkspaceEvent(workspace._id, 'invoice:paid', {
    invoiceId: String(populated._id),
    invoiceNumber: populated.invoiceNumber,
    status: populated.status,
    paidMinor: populated.paidMinor,
    totalMinor: populated.totalMinor,
  });
  emitWorkspaceEvent(workspace._id, 'notification:new', {
    type: 'INVOICE_PAID',
    title: `Payment received: ${populated.invoiceNumber}`,
  });

  return populated;
}
