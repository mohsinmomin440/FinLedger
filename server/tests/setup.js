import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { clearTestEmailInbox } from '../src/services/email.service.js';
import { RECEIPTS_ROOT_DIR } from '../src/middleware/upload.js';

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = 'true';

beforeAll(async () => {
  await connectDatabase();
});

afterEach(async () => {
  clearTestEmailInbox();
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((col) => col.deleteMany({})));
  }
});

afterAll(async () => {
  await disconnectDatabase();
  // Clean uploaded test files while preserving .gitkeep
  try {
    const entries = await fs.readdir(RECEIPTS_ROOT_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.gitkeep') continue;
      await fs.rm(`${RECEIPTS_ROOT_DIR}/${entry.name}`, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});
