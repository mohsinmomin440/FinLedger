import { RecurringRule, Workspace } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { createTransaction } from './transaction.service.js';
import { createInvoice, sendInvoice } from './invoice.service.js';

export function computeNextRunAt(fromDate, frequency) {
  const next = new Date(fromDate);
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (frequency === 'MONTHLY') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else if (frequency === 'YEARLY') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    throw new Error(`Unsupported frequency: ${frequency}`);
  }
  return next;
}

export async function createRecurringRule({ workspaceId, actorId, payload }) {
  return RecurringRule.create({
    workspace: workspaceId,
    name: payload.name.trim(),
    kind: payload.kind,
    frequency: payload.frequency,
    nextRunAt: new Date(payload.nextRunAt),
    isActive: payload.isActive ?? true,
    templatePayload: payload.templatePayload,
    createdBy: actorId,
  });
}

export async function listRecurringRules({ workspaceId }) {
  return RecurringRule.find({ workspace: workspaceId }).sort({ nextRunAt: 1, createdAt: -1 });
}

export async function updateRecurringRule({ workspaceId, ruleId, payload }) {
  const updated = await RecurringRule.findOneAndUpdate(
    { _id: ruleId, workspace: workspaceId },
    { $set: payload },
    { new: true, runValidators: true }
  );
  if (!updated) throw ApiError.notFound('Recurring rule not found', 'RULE_NOT_FOUND');
  return updated;
}

export async function deleteRecurringRule({ workspaceId, ruleId }) {
  const deleted = await RecurringRule.findOneAndDelete({ _id: ruleId, workspace: workspaceId });
  if (!deleted) throw ApiError.notFound('Recurring rule not found', 'RULE_NOT_FOUND');
  return { deleted: true };
}

async function executeRuleAction({ workspace, rule, runDate }) {
  if (rule.kind === 'TRANSACTION') {
    const tx = await createTransaction({
      workspace,
      actorId: rule.createdBy,
      payload: {
        ...rule.templatePayload,
        occurredAt: runDate,
        recurringRuleId: rule._id,
      },
    });
    return { kind: 'TRANSACTION', createdId: String(tx._id) };
  }

  if (rule.kind === 'INVOICE') {
    const dueDays = Number(rule.templatePayload.dueDays || 14);
    const dueDate = new Date(runDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + dueDays);

    const invoice = await createInvoice({
      workspace,
      actorId: rule.createdBy,
      payload: {
        ...rule.templatePayload,
        issueDate: runDate,
        dueDate,
        recurringRuleId: rule._id,
      },
    });

    if (rule.templatePayload.autoSend) {
      await sendInvoice({ workspace, actorId: rule.createdBy, invoiceId: invoice._id });
    }
    return { kind: 'INVOICE', createdId: String(invoice._id) };
  }

  throw new Error(`Unsupported recurring rule kind: ${rule.kind}`);
}

/**
 * Processes all due active recurring rules using an atomic findOneAndUpdate
 * lock on `(isActive: true, nextRunAt: expectedNextRunAt)` so concurrent or
 * repeated executions never double-spawn transactions or invoices.
 */
export async function processDueRecurringRules(now = new Date()) {
  const candidates = await RecurringRule.find({
    isActive: true,
    nextRunAt: { $lte: now },
  }).sort({ nextRunAt: 1 });

  const processed = [];

  for (const candidate of candidates) {
    const scheduledRunAt = candidate.nextRunAt;
    const nextRunAt = computeNextRunAt(scheduledRunAt, candidate.frequency);

    const lockedRule = await RecurringRule.findOneAndUpdate(
      {
        _id: candidate._id,
        isActive: true,
        nextRunAt: scheduledRunAt,
      },
      {
        $set: {
          lastRunAt: now,
          nextRunAt,
        },
      },
      { new: true }
    );

    if (!lockedRule) {
      continue;
    }

    const workspace = await Workspace.findById(lockedRule.workspace);
    if (!workspace) continue;

    const spawned = await executeRuleAction({
      workspace,
      rule: lockedRule,
      runDate: scheduledRunAt,
    });
    processed.push({ ruleId: String(lockedRule._id), ...spawned });
  }

  return processed;
}

export async function triggerRecurringRuleNow({ workspace, ruleId }) {
  const rule = await RecurringRule.findOne({ _id: ruleId, workspace: workspace._id });
  if (!rule) throw ApiError.notFound('Recurring rule not found', 'RULE_NOT_FOUND');

  const now = new Date();
  rule.lastRunAt = now;
  rule.nextRunAt = computeNextRunAt(now, rule.frequency);
  await rule.save();

  const spawned = await executeRuleAction({ workspace, rule, runDate: now });
  return { rule, spawned };
}
