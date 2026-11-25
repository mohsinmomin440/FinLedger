import http from 'node:http';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { initSocketServer } from './sockets/index.js';
import { startRecurringJob, stopRecurringJob } from './jobs/recurring.job.js';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  startRecurringJob(60_000);

  httpServer.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        memoryDb: env.USE_MEMORY_DB,
      },
      `FinLedger API listening on http://localhost:${env.PORT}`
    );
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down FinLedger API...');
    stopRecurringJob();
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start FinLedger server');
  process.exit(1);
});
