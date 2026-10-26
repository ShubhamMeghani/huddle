import { defineConfig } from '@playwright/test';

/** Deploy checks: production (DEPLOY_URL) after the owner pushes, or a local production
 *  build with real services via `npm run test:real`. Never starts a server itself. */
export default defineConfig({
  testDir: 'tests/deploy',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  // actionTimeout: a click on an element that a phase change removed must fail, not wait for the test timeout.
  use: { baseURL: process.env.DEPLOY_URL ?? 'http://localhost:3000', trace: 'retain-on-failure', actionTimeout: 15_000 },
  projects: [{ name: 'deploy' }],
});
