import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createRecurringRuleSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    kind: z.enum(['TRANSACTION', 'INVOICE']),
    frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']),
    nextRunAt: z.string().min(4),
    isActive: z.boolean().optional().default(true),
    templatePayload: z.record(z.any()),
  }),
};

export const updateRecurringRuleSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
    nextRunAt: z.string().optional(),
    isActive: z.boolean().optional(),
    templatePayload: z.record(z.any()).optional(),
  }),
};

export const recurringRuleIdParamSchema = {
  params: z.object({ id: objectId }),
};
