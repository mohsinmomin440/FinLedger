import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createAccountSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY']),
    subtype: z.enum(['CASH', 'BANK', 'CARD', 'RECEIVABLE', 'PAYABLE', 'OPERATING', 'EQUITY']),
    currency: z.enum(CURRENCIES).optional(),
    openingBalanceMinor: z.number().int().nonnegative().optional().default(0),
  }),
};

export const updateAccountSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    archived: z.boolean().optional(),
  }),
};

export const listLedgerQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    accountId: objectId.optional(),
    referenceType: z
      .enum([
        'TRANSACTION',
        'TRANSFER',
        'INVOICE_ACCRUAL',
        'INVOICE_PAYMENT',
        'SETTLEMENT',
        'REVERSAL',
        'OPENING',
      ])
      .optional(),
  }),
};
