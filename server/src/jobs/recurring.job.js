import { logger } from '../config/logger.js';
import { processDueRecurringRules } from '../services/recurring.service.js';

let intervalId = null;

export function startRecurringJob(intervalMs = 60_000) {
  if (intervalId) return;
  intervalId = setInterval(async () => {
    try {
      const processed = await processDueRecurringRules(new Date());
      if (processed.length > 0) {
        logger.info({ count: processed.length }, 'Processed due recurring rules');
      }
    } catch (err) {
      logger.error({ err }, 'Error in recurring rule background job');
    }
  }, intervalMs);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }
}

export function stopRecurringJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
