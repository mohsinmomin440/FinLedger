import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadEnv } from '../server/src/config/env.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const dotenv = require('dotenv');

const rootDir = process.cwd();
const clientDistIndex = path.join(rootDir, 'client', 'dist', 'index.html');

console.log('FinLedger Production Configuration Check\n');

loadEnv({
  NODE_ENV: 'production',
  USE_MEMORY_DB: 'false',
  MONGO_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/finledger',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  CLIENT_URL: 'https://finledger.vercel.app',
  CORS_ORIGIN: 'https://finledger.vercel.app',
});
console.log('✓ Production env validation guard verified (fail-fast rules active)');

if (fs.existsSync(clientDistIndex)) {
  console.log('✓ Production frontend bundle found (client/dist/index.html)');
} else {
  console.error('✗ client/dist/index.html missing — run `npm run build` first');
  process.exit(1);
}

const serverEnvPath = path.join(rootDir, 'server', '.env');
if (fs.existsSync(serverEnvPath)) {
  console.log('ℹ server/.env detected; validating against production constraints...');
  const parsed = dotenv.config({ path: serverEnvPath }).parsed || {};
  loadEnv({ ...parsed, NODE_ENV: 'production' });
  console.log('✓ server/.env passes all production environment requirements');
} else {
  console.log(
    'ℹ No local server/.env file found (expected when setting secrets in Render/Vercel dashboards).'
  );
}
