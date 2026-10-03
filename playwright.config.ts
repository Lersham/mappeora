import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the web app (npm run test:e2e). They run against the
 * production build, with the network to ARASAAC, jsDelivr and Google mocked
 * (e2e/fixtures.ts): the suite works offline and gives the same results
 * every time. Voice (speech synthesis and recognition) is simulated too.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/results',
  fullyParallel: true,
  // Building maps is CPU-heavy: too many browsers at once make tests flaky.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'it-IT',
    // The service worker would cache between tests and hide network mocks.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Cloud sessions have Chromium preinstalled here; elsewhere Playwright's own is used.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] },
    },
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
