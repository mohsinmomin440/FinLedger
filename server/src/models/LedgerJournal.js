import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const journalEntryLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    side: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'amountMinor must be a safe integer',
      },
    },
  },
  { _id: false }
);

const ledgerJournalSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    referenceType: {
      type: String,
      enum: [
        'TRANSACTION',
        'TRANSFER',
        'INVOICE_ACCRUAL',
        'INVOICE_PAYMENT',
        'SETTLEMENT',
        'REVERSAL',
        'OPENING',
      ],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' },
    reversesJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
    reversedByJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
    currency: { type: String, enum: CURRENCIES, required: true },
    totalMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'totalMinor must be a safe integer',
      },
    },
    entries: {
      type: [journalEntryLineSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2,
        message: 'LedgerJournal requires at least 2 balanced entries',
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ledgerJournalSchema.index({ workspace: 1, date: -1 });
ledgerJournalSchema.index({ workspace: 1, referenceType: 1, referenceId: 1 });

export const LedgerJournal = mongoose.model('LedgerJournal', ledgerJournalSchema);
