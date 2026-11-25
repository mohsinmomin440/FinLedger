import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: {
      type: String,
      enum: ['TRANSACTION', 'GROUP_EXPENSE', 'INVOICE', 'GENERAL'],
      default: 'GENERAL',
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

receiptSchema.index({ workspace: 1, entityType: 1, entityId: 1 });

export const Receipt = mongoose.model('Receipt', receiptSchema);
