import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'cross-env USE_MEMORY_DB=true PORT=5055 CORS_ORIGIN=http://localhost:5175 CLIENT_URL=http://localhost:5175 npm --prefix server run start',
      url: 'http://localhost:5055/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'cross-env VITE_API_PROXY_TARGET=http://localhost:5055 npm --prefix client run dev -- --port 5175 --strictPort',
      url: 'http://localhost:5175/login',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
