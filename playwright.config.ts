import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx vite preview --host 0.0.0.0 --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 667 } },
    },
  ],
});
