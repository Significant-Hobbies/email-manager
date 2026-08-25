/**
 * Playwright config — desktop + mobile-viewport projects.
 *
 * The `mobile` project uses the iPhone 13 device descriptor (390px wide — the
 * fleet Wave 4 mobile target) so mobile-layout regressions are caught in CI
 * alongside the `desktop` baseline.
 *
 * Run only the mobile project:  pnpm exec playwright test --project=mobile
 */
import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.PLAYWRIGHT_PORT ?? '8787';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm build && wrangler dev --port ${testPort}`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
