import mongoose from 'mongoose';

const recurringRuleSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ['TRANSACTION', 'INVOICE'], required: true },
    frequency: { type: String, enum: ['WEEKLY', 'MONTHLY', 'YEARLY'], required: true },
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    templatePayload: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

recurringRuleSchema.index({ isActive: 1, nextRunAt: 1 });

export const RecurringRule = mongoose.model('RecurringRule', recurringRuleSchema);
