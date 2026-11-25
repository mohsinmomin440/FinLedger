import { env } from '../config/env.js';
import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../middleware/csrf.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { generateOpaqueToken } from '../utils/crypto.js';
import * as authService from '../services/auth.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookies(res, refreshToken, csrfToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    path: '/api/v1/auth',
    maxAge: SEVEN_DAYS_MS,
  });

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    path: '/api/v1/auth',
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: env.isProd ? 'none' : 'lax',
    secure: env.isProd,
    path: '/',
  });
}

function requestMeta(req) {
  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
  };
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body, requestMeta(req));
  setAuthCookies(res, result.refreshToken, result.csrfToken);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: {
      user: result.user,
      workspace: result.workspace,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body, requestMeta(req));
  setAuthCookies(res, result.refreshToken, result.csrfToken);
  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      user: result.user,
      workspace: result.workspace,
      workspaces: result.workspaces,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  try {
    const result = await authService.refreshSession(rawToken, requestMeta(req));
    setAuthCookies(res, result.refreshToken, result.csrfToken);
    return sendSuccess(res, {
      message: 'Session refreshed',
      data: {
        user: result.user,
        workspace: result.workspace,
        workspaces: result.workspaces,
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
      },
    });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logoutSession(rawToken);
  clearAuthCookies(res);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  const data = await authService.getMe(req.user._id);
  return sendSuccess(res, { data });
});

export const listSessions = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const sessions = await authService.listActiveSessions(req.user._id, rawToken);
  return sendSuccess(res, { data: sessions });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const data = await authService.revokeUserSession(req.user._id, req.params.id);
  return sendSuccess(res, { message: 'Session revoked', data });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.requestPasswordReset(req.body.email);
  return sendSuccess(res, {
    message: 'If an account matches that email, reset instructions were sent',
    data,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body);
  return sendSuccess(res, { message: 'Password reset successful', data });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await authService.verifyEmailToken(req.body.token);
  return sendSuccess(res, { message: 'Email verified successfully', data: { user } });
});

export const getCsrfBootstrap = asyncHandler(async (req, res) => {
  const hasRefresh = Boolean(req.cookies?.[REFRESH_COOKIE_NAME]);
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME] || null;
  if (hasRefresh && !csrfToken) {
    csrfToken = generateOpaqueToken(24);
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      sameSite: env.isProd ? 'none' : 'lax',
      secure: env.isProd,
      path: '/',
      maxAge: SEVEN_DAYS_MS,
    });
  }
  return sendSuccess(res, {
    data: {
      hasSession: hasRefresh && Boolean(csrfToken),
      csrfToken: hasRefresh ? csrfToken : null,
    },
  });
});
