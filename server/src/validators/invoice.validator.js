import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createClientSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: z.string().trim().max(40).optional().default(''),
    company: z.string().trim().max(140).optional().default(''),
    billingAddress: z.string().trim().max(300).optional().default(''),
    taxId: z.string().trim().max(60).optional().default(''),
    defaultCurrency: z.enum(CURRENCIES).optional().default('INR'),
  }),
};

export const updateClientSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(40).optional(),
    company: z.string().trim().max(140).optional(),
    billingAddress: z.string().trim().max(300).optional(),
    taxId: z.string().trim().max(60).optional(),
    defaultCurrency: z.enum(CURRENCIES).optional(),
  }),
};

export const clientIdParamSchema = {
  params: z.object({ id: objectId }),
};

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  qty: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  taxRateBps: z.number().int().min(0).max(10000).optional().default(0),
});

export const createInvoiceSchema = {
  body: z.object({
    clientId: objectId,
    invoiceNumber: z.string().trim().max(60).optional(),
    issueDate: z.string().optional(),
    dueDate: z.string().min(4),
    currency: z.enum(CURRENCIES).optional(),
    manualRate: z.union([z.string(), z.number()]).optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1),
    discountMinor: z.number().int().nonnegative().optional().default(0),
    notes: z.string().trim().max(1000).optional().default(''),
  }),
};

export const updateInvoiceSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    clientId: objectId.optional(),
    issueDate: z.string().optional(),
    dueDate: z.string().optional(),
    currency: z.enum(CURRENCIES).optional(),
    manualRate: z.union([z.string(), z.number()]).optional().nullable(),
    lineItems: z.array(lineItemSchema).min(1).optional(),
    discountMinor: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
};

export const invoiceIdParamSchema = {
  params: z.object({ id: objectId }),
};

export const recordInvoicePaymentSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    amountMinor: z.number().int().positive(),
    paidAt: z.string().optional(),
    method: z.string().trim().max(60).optional().default('BANK_TRANSFER'),
    reference: z.string().trim().max(120).optional().default(''),
    accountId: objectId.optional(),
  }),
};
