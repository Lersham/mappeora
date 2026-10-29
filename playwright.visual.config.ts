import { defineConfig, devices } from '@playwright/test';

/**
 * Visual pass (npm run test:visual): not a test suite but a camera. It walks
 * the main screens in every theme and on phone, iPhone, iPad and desktop
 * sizes, and records a whole flow frame by frame, so a person (or Claude) can
 * look for what an assertion never catches: spacing, alignment, a colour out
 * of place, a jump in an animation. Everything lands in e2e/results/visual,
 * rewritten at each run. Not run in CI.
 *
 * All projects run in Chromium: iPhone and iPad give their size and touch
 * screen, not Safari's engine (WebKit is checked by the main suite).
 */
// Cloud sessions have Chromium preinstalled here; elsewhere Playwright's own is used.
const chromiumLaunch = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
const chromium = { browserName: 'chromium' as const, launchOptions: chromiumLaunch };

export default defineConfig({
  testDir: 'e2e-visual',
  // Inside e2e/results, which is already ignored by git.
  outputDir: 'e2e/results/visual',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'it-IT',
    serviceWorkers: 'block',
    video: 'on',
  },
  projects: [
    { name: 'telefono', use: { ...devices['Pixel 7'], ...chromium } },
    { name: 'iphone', use: { ...devices['iPhone 15'], ...chromium } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], ...chromium } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, ...chromium } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
