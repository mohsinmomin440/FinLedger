import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: ['PERSONAL', 'BUSINESS'], default: 'PERSONAL' },
    baseCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

workspaceSchema.index({ owner: 1 });

export const Workspace = mongoose.model('Workspace', workspaceSchema);
