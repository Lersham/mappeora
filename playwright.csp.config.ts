import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test of the production headers (npm run test:csp). The app is built
 * and served from dist/ by scripts/serve-dist.mjs, which applies the headers of
 * vercel.json (the Content-Security-Policy above all). `vite preview`, used by
 * the main suite, sends none: a feature that the policy blocks would pass
 * every other test and break only on the real site.
 */
const PORT = Number(process.env.CSP_PORT ?? 4190);
// Cloud sessions have Chromium preinstalled here; elsewhere Playwright's own is used.
const chromiumLaunch = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: 'e2e-csp',
  // Inside e2e/results, which is already ignored by git.
  outputDir: 'e2e/results/csp',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'it-IT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, launchOptions: chromiumLaunch },
    },
  ],
  webServer: {
    command: `npm run build && node scripts/serve-dist.mjs --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Always its own build: a server left running would serve an old dist/ (or another app) and the test would prove nothing.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
