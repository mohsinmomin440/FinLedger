import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 0.001 },
    unitPriceMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: 'unitPriceMinor must be integer' },
    },
    taxRateBps: {
      type: Number,
      default: 0,
      min: 0,
      max: 10000,
      validate: { validator: Number.isSafeInteger, message: 'taxRateBps must be integer' },
    },
    lineTotalMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: 'lineTotalMinor must be integer' },
    },
  },
  { _id: false }
);

const invoicePaymentSchema = new mongoose.Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'amountMinor must be integer' },
    },
    baseAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'baseAmountMinor must be integer' },
    },
    paidAt: { type: Date, required: true, default: Date.now },
    method: { type: String, trim: true, maxlength: 60, default: 'BANK_TRANSFER' },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    ledgerJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 60 },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
      default: 'DRAFT',
    },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    currency: { type: String, enum: CURRENCIES, required: true },
    exchangeRate: { type: String, required: true, default: '1.000000' },
    rateSource: { type: String, default: 'IDENTITY' },
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 1,
        message: 'Invoice requires at least one line item',
      },
    },
    subtotalMinor: { type: Number, required: true, min: 0 },
    taxMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    baseTotalMinor: { type: Number, required: true, min: 0 },
    paidMinor: { type: Number, default: 0, min: 0 },
    payments: { type: [invoicePaymentSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    accrualJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
    recurringRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ workspace: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ workspace: 1, status: 1, dueDate: 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
