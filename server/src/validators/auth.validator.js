import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    defaultCurrency: z.enum(CURRENCIES).optional().default('INR'),
    workspaceName: z.string().trim().min(2).max(120).optional(),
    workspaceType: z.enum(['PERSONAL', 'BUSINESS']).optional().default('PERSONAL'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().trim().email(),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(10),
    password: z.string().min(8).max(128),
  }),
};

export const verifyEmailSchema = {
  body: z.object({
    token: z.string().min(10),
  }),
};

export const sessionIdParamSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID'),
  }),
};
