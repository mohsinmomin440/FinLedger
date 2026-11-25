import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const groupMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, lowercase: true, trim: true, default: '' },
  },
  { _id: true }
);

const expenseGroupSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 240, default: '' },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    members: {
      type: [groupMemberSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 1,
        message: 'Expense group must have at least one member',
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

expenseGroupSchema.index({ workspace: 1, createdAt: -1 });

export const ExpenseGroup = mongoose.model('ExpenseGroup', expenseGroupSchema);
