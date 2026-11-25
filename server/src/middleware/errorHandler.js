import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      errors: err.errors,
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Receipt exceeds maximum size of 5 MB'
        : `Upload error: ${err.message}`;
    return sendError(res, {
      statusCode: 400,
      message,
      code: err.code || 'UPLOAD_ERROR',
    });
  }

  if (err instanceof ZodError) {
    return sendError(res, {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err?.name === 'CastError') {
    return sendError(res, {
      statusCode: 400,
      message: `Invalid identifier for ${err.path}`,
      code: 'INVALID_ID',
    });
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return sendError(res, {
      statusCode: 409,
      message: `Duplicate value for ${fields.join(', ') || 'unique field'}`,
      code: 'DUPLICATE_KEY',
    });
  }

  logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled error');
  return sendError(res, {
    statusCode: 500,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
