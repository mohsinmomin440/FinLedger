import { ApiError } from '../utils/ApiError.js';
import { timingSafeEqualStrings } from '../utils/crypto.js';

export const CSRF_COOKIE_NAME = 'finledger_csrf';
export const REFRESH_COOKIE_NAME = 'finledger_refresh';

export function requireCsrf(req, _res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (
    !cookieToken ||
    !headerToken ||
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    !timingSafeEqualStrings(cookieToken, headerToken)
  ) {
    return next(ApiError.forbidden('Invalid or missing CSRF token', 'CSRF_INVALID'));
  }

  return next();
}
