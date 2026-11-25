import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'RATE_LIMITED',
    errors: null,
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 400 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
    code: 'RATE_LIMITED',
    errors: null,
  },
});
