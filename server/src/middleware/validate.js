import { ApiError } from '../utils/ApiError.js';

export function validate(schemas) {
  return (req, _res, next) => {
    const errors = [];

    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            location: part,
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        req[part] = result.data;
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', errors));
    }
    return next();
  };
}
