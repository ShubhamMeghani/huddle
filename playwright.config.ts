import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/** E2E against the local production build in test mode, on Android (Chromium) and iPhone (WebKit). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // Fail with a report well before the CI job limit (40 min) instead of being cancelled without one.
  globalTimeout: process.env.CI ? 25 * 60_000 : undefined,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Video only on the CI retry of a failing test: recording every page in every run costs enough CPU to make
    // WebKit's timing-sensitive steps flaky under full-suite load. Traces include a filmstrip on every failure.
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npx tsx scripts/e2e-server.ts',
    url: `http://localhost:${PORT}/api/identity/me`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
