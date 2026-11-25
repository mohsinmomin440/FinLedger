import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const accountSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'],
      required: true,
    },
    subtype: {
      type: String,
      enum: ['CASH', 'BANK', 'CARD', 'RECEIVABLE', 'PAYABLE', 'OPERATING', 'EQUITY'],
      required: true,
    },
    currency: { type: String, enum: CURRENCIES, required: true },
    balanceMinor: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'balanceMinor must be a safe integer',
      },
    },
    archived: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

accountSchema.index({ workspace: 1, name: 1 }, { unique: true });
accountSchema.index({ workspace: 1, type: 1, archived: 1 });

export const Account = mongoose.model('Account', accountSchema);
