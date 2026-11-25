import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
    ],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: !env.isTest,
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
});
