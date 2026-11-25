import mongoose from 'mongoose';
import { CURRENCIES } from '../constants/currencies.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    defaultCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpiresAt: { type: Date, select: false, default: null },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpiresAt: { type: Date, select: false, default: null },
    activeWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
