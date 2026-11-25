import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createWorkspaceSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(['PERSONAL', 'BUSINESS']).optional().default('BUSINESS'),
    baseCurrency: z.enum(CURRENCIES).optional().default('INR'),
  }),
};

export const updateWorkspaceSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    type: z.enum(['PERSONAL', 'BUSINESS']).optional(),
    baseCurrency: z.enum(CURRENCIES).optional(),
  }),
};

export const switchWorkspaceSchema = {
  params: z.object({
    workspaceId: objectId,
  }),
};

export const inviteMemberSchema = {
  body: z.object({
    email: z.string().trim().email(),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  }),
};

export const acceptInvitationSchema = {
  body: z.object({
    token: z.string().min(10),
  }),
};

export const updateMemberRoleSchema = {
  params: z.object({
    memberId: objectId,
  }),
  body: z.object({
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  }),
};

export const memberIdParamSchema = {
  params: z.object({
    memberId: objectId,
  }),
};
