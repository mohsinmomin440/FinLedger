import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const transactionSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER'], required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    toAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    originalAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'originalAmountMinor must be integer' },
    },
    originalCurrency: { type: String, enum: CURRENCIES, required: true },
    exchangeRate: { type: String, required: true, default: '1.000000' },
    rateSource: { type: String, default: 'IDENTITY' },
    baseAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'baseAmountMinor must be integer' },
    },
    occurredAt: { type: Date, required: true, default: Date.now },
    recurringRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', default: null },
    receiptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' }],
    ledgerJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
    status: { type: String, enum: ['POSTED', 'VOIDED'], default: 'POSTED' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ workspace: 1, occurredAt: -1 });
transactionSchema.index({ workspace: 1, type: 1, category: 1, occurredAt: -1 });
transactionSchema.index({ workspace: 1, account: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
