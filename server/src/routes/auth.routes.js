import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.get('/csrf', authController.getCsrfBootstrap);
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, requireCsrf, authController.refresh);
router.post('/logout', requireCsrf, authController.logout);
router.get('/me', requireAuth, authController.me);
router.get('/sessions', requireAuth, requireCsrf, authController.listSessions);
router.delete(
  '/sessions/:id',
  requireAuth,
  requireCsrf,
  validate(sessionIdParamSchema),
  authController.revokeSession
);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

export default router;
