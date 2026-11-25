import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const settlementSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseGroup', required: true, index: true },
    fromMemberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    toMemberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'amountMinor must be integer' },
    },
    currency: { type: String, enum: CURRENCIES, required: true },
    exchangeRate: { type: String, required: true, default: '1.000000' },
    rateSource: { type: String, default: 'IDENTITY' },
    baseAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'baseAmountMinor must be integer' },
    },
    note: { type: String, trim: true, maxlength: 240, default: '' },
    settledAt: { type: Date, required: true, default: Date.now },
    ledgerJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerJournal', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

settlementSchema.index({ workspace: 1, group: 1, settledAt: -1 });

export const Settlement = mongoose.model('Settlement', settlementSchema);
