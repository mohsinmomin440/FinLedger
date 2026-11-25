import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const clientSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    company: { type: String, trim: true, maxlength: 140, default: '' },
    billingAddress: { type: String, trim: true, maxlength: 300, default: '' },
    taxId: { type: String, trim: true, maxlength: 60, default: '' },
    defaultCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
  },
  { timestamps: true }
);

clientSchema.index({ workspace: 1, email: 1 });
clientSchema.index({ workspace: 1, name: 1 });

export const Client = mongoose.model('Client', clientSchema);
