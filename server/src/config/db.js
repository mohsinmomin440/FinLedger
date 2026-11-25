import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { env } from './env.js';
import { logger } from './logger.js';

let memoryReplSet = null;
let transactionsSupported = false;

export function isTransactionSupported() {
  return transactionsSupported;
}

export function sessionOptions(session) {
  return session ? { session } : {};
}

async function detectTransactionSupport() {
  try {
    const admin = mongoose.connection.db.admin();
    const hello = await admin.command({ hello: 1 });
    transactionsSupported = Boolean(hello?.setName || hello?.msg === 'isdbgrid');
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

export async function connectDatabase(overrideUri = null) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  let uri = overrideUri || env.MONGO_URI;

  if (!overrideUri && env.USE_MEMORY_DB) {
    logger.info('Starting MongoMemoryReplSet for zero-config local ACID transactions...');
    memoryReplSet = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
        storageEngine: 'wiredTiger',
      },
    });
    uri = memoryReplSet.getUri();
  }

  if (!uri) {
    throw new Error('No MongoDB URI available to connect');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
  });

  const supported = await detectTransactionSupport();
  logger.info(
    {
      memoryDb: Boolean(memoryReplSet),
      transactionsSupported: supported,
    },
    'Connected to MongoDB'
  );

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryReplSet) {
    await memoryReplSet.stop();
    memoryReplSet = null;
  }
  transactionsSupported = false;
}

/**
 * Executes `work(session)` inside a MongoDB multi-document ACID transaction when
 * running against a Replica Set / Atlas / MongoMemoryReplSet, and falls back
 * cleanly to non-transactional execution on standalone servers.
 */
export async function runInTransaction(work) {
  if (!transactionsSupported) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
