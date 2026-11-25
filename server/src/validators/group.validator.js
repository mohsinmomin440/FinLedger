import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createGroupSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(240).optional().default(''),
    currency: z.enum(CURRENCIES).optional(),
    members: z
      .array(
        z.object({
          userId: objectId.optional().nullable(),
          name: z.string().trim().min(1).max(100),
          email: z.string().trim().email().optional().or(z.literal('')),
        })
      )
      .optional()
      .default([]),
  }),
};

export const addGroupMemberSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    userId: objectId.optional().nullable(),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().optional().or(z.literal('')),
  }),
};

export const groupIdParamSchema = {
  params: z.object({ id: objectId }),
};

const splitItemInput = z.object({
  memberId: objectId,
  shareValue: z.number().nonnegative().optional().default(1),
  owedMinor: z.number().int().nonnegative().optional(),
});

export const addGroupExpenseSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    title: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(500).optional().default(''),
    paidByMemberId: objectId,
    originalAmountMinor: z.number().int().positive(),
    originalCurrency: z.enum(CURRENCIES).optional(),
    manualRate: z.union([z.string(), z.number()]).optional().nullable(),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']).default('EQUAL'),
    splits: z.array(splitItemInput).optional(),
    occurredAt: z.string().optional(),
    receiptIds: z.array(objectId).optional().default([]),
  }),
};

export const updateGroupExpenseSchema = {
  params: z.object({ id: objectId, expenseId: objectId }),
  body: z.object({
    title: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(500).optional(),
    paidByMemberId: objectId.optional(),
    originalAmountMinor: z.number().int().positive().optional(),
    originalCurrency: z.enum(CURRENCIES).optional(),
    manualRate: z.union([z.string(), z.number()]).optional().nullable(),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']).optional(),
    splits: z.array(splitItemInput).optional(),
    occurredAt: z.string().optional(),
  }),
};

export const groupExpenseIdParamSchema = {
  params: z.object({ id: objectId, expenseId: objectId }),
};

export const recordSettlementSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    fromMemberId: objectId,
    toMemberId: objectId,
    amountMinor: z.number().int().positive(),
    currency: z.enum(CURRENCIES).optional(),
    manualRate: z.union([z.string(), z.number()]).optional().nullable(),
    note: z.string().trim().max(240).optional().default(''),
    settledAt: z.string().optional(),
    accountId: objectId.optional(),
  }),
};
