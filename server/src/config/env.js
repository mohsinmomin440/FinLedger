import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ephemeralAccessSecret = crypto.randomBytes(48).toString('hex');
const ephemeralRefreshSecret = crypto.randomBytes(48).toString('hex');

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  USE_MEMORY_DB: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  MONGO_URI: z.string().optional().default(''),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().optional().default(''),
  JWT_REFRESH_SECRET: z.string().optional().default(''),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('FinLedger <noreply@finledger.local>'),
  RECEIPTS_DIR: z.string().optional().default(''),
  SERVE_CLIENT: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  LOG_LEVEL: z.string().optional().default(''),
});

export function loadEnv(rawEnv = process.env) {
  const parsed = baseEnvSchema.parse(rawEnv);
  const isProd = parsed.NODE_ENV === 'production';

  if (isProd) {
    if (parsed.USE_MEMORY_DB) {
      throw new Error('USE_MEMORY_DB cannot be enabled in production');
    }
    if (!parsed.MONGO_URI || !parsed.MONGO_URI.trim()) {
      throw new Error('MONGO_URI is required in production');
    }
    if (!parsed.JWT_ACCESS_SECRET || parsed.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('JWT_ACCESS_SECRET (min 32 chars) is required in production');
    }
    if (!parsed.JWT_REFRESH_SECRET || parsed.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT_REFRESH_SECRET (min 32 chars) is required in production');
    }
    if (!parsed.CORS_ORIGIN || !parsed.CORS_ORIGIN.trim()) {
      throw new Error('CORS_ORIGIN is required in production');
    }
  } else {
    if (!parsed.USE_MEMORY_DB && !parsed.MONGO_URI) {
      parsed.USE_MEMORY_DB = true;
    }
  }

  const cleanClientUrl = parsed.CLIENT_URL.trim().replace(/\/+$/, '');
  const corsOrigins = parsed.CORS_ORIGIN.split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (cleanClientUrl && !corsOrigins.includes(cleanClientUrl)) {
    corsOrigins.push(cleanClientUrl);
  }

  return {
    ...parsed,
    CLIENT_URL: cleanClientUrl,
    isProd,
    isTest: parsed.NODE_ENV === 'test',
    isDev: parsed.NODE_ENV === 'development',
    corsOrigins,
    JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET || ephemeralAccessSecret,
    JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET || ephemeralRefreshSecret,
    LOG_LEVEL: parsed.LOG_LEVEL || (parsed.NODE_ENV === 'test' ? 'silent' : 'info'),
  };
}

export const env = loadEnv(process.env);
