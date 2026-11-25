import mongoose from 'mongoose';
import { WORKSPACE_ROLES } from '../constants/roles.js';

const invitationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: WORKSPACE_ROLES.filter((r) => r !== 'OWNER'), default: 'MEMBER' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

invitationSchema.index({ workspace: 1, email: 1, status: 1 });

export const Invitation = mongoose.model('Invitation', invitationSchema);
