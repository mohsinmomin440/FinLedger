import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');
const optionalRate = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .refine(
    (v) => v === undefined || v === null || v === '' || /^\d+(\.\d+)?$/.test(String(v).trim()),
    'manualRate must be a positive decimal'
  );

export const createTransactionSchema = {
  body: z.object({
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    accountId: objectId,
    toAccountId: objectId.optional().nullable(),
    category: z.string().trim().min(1).max(80).default('Other'),
    description: z.string().trim().min(1).max(240),
    originalAmountMinor: z.number().int().positive(),
    originalCurrency: z.enum(CURRENCIES).optional(),
    manualRate: optionalRate,
    occurredAt: z.string().datetime({ offset: true }).or(z.string().min(4)).optional(),
    receiptIds: z.array(objectId).optional().default([]),
  }),
};

export const updateTransactionSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
    accountId: objectId.optional(),
    toAccountId: objectId.optional().nullable(),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(240).optional(),
    originalAmountMinor: z.number().int().positive().optional(),
    originalCurrency: z.enum(CURRENCIES).optional(),
    manualRate: optionalRate,
    occurredAt: z.string().optional(),
    receiptIds: z.array(objectId).optional(),
  }),
};

export const transactionIdParamSchema = {
  params: z.object({ id: objectId }),
};

export const listTransactionsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(25),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
    accountId: objectId.optional(),
    category: z.string().trim().optional(),
    q: z.string().trim().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    includeVoided: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
  }),
};
