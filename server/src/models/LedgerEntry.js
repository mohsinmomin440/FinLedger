import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const ledgerEntrySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
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
    currency: { type: String, enum: CURRENCIES, required: true },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ workspace: 1, account: 1, date: -1 });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
