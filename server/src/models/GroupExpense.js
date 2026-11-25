import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const splitItemSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    shareValue: { type: Number, required: true, min: 0 },
    owedMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: 'owedMinor must be integer' },
    },
  },
  { _id: false }
);

const groupExpenseSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseGroup', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    paidByMemberId: { type: mongoose.Schema.Types.ObjectId, required: true },
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
    splitType: {
      type: String,
      enum: ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'],
      required: true,
    },
    splits: {
      type: [splitItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 1,
        message: 'GroupExpense requires at least one split item',
      },
    },
    occurredAt: { type: Date, required: true, default: Date.now },
    receiptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' }],
    isSettled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

groupExpenseSchema.index({ workspace: 1, group: 1, occurredAt: -1 });

export const GroupExpense = mongoose.model('GroupExpense', groupExpenseSchema);
