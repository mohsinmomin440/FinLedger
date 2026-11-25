import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    userAgent: { type: String, default: 'unknown' },
    ipAddress: { type: String, default: 'unknown' },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
