import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'cd server && npx tsx src/index.ts',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd client && npx vite --port 5173',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
