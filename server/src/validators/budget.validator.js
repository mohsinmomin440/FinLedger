import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const upsertBudgetSchema = {
  body: z.object({
    category: z.string().trim().min(1).max(80),
    monthKey: z.string().regex(/^\d{4}-\d{2}$/, 'monthKey must be YYYY-MM'),
    limitMinor: z.number().int().positive(),
    alertThresholdPercent: z.number().int().min(1).max(100).optional().default(80),
  }),
};

export const listBudgetsQuerySchema = {
  query: z.object({
    monthKey: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'monthKey must be YYYY-MM')
      .optional(),
  }),
};

export const budgetIdParamSchema = {
  params: z.object({ id: objectId }),
};
