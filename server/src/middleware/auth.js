import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/crypto.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing bearer access token', 'MISSING_ACCESS_TOKEN');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw ApiError.unauthorized('Empty bearer access token', 'MISSING_ACCESS_TOKEN');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token', 'INVALID_ACCESS_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
  }

  req.user = user;
  next();
});
