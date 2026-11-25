export function sendSuccess(res, { statusCode = 200, message = 'OK', data = null, meta = null } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
}

export function sendError(res, { statusCode = 500, message = 'Internal server error', code = 'INTERNAL_ERROR', errors = null } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    errors,
  });
}
