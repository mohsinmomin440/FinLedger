import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    monthKey: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'monthKey must be YYYY-MM'],
    },
    limitMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'limitMinor must be integer' },
    },
    alertThresholdPercent: { type: Number, default: 80, min: 1, max: 100 },
    lastAlertLevel: { type: Number, enum: [0, 80, 100], default: 0 },
  },
  { timestamps: true }
);

budgetSchema.index({ workspace: 1, category: 1, monthKey: 1 }, { unique: true });

export const Budget = mongoose.model('Budget', budgetSchema);
