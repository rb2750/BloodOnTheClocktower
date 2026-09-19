import { defineConfig, devices } from '@playwright/test'

/**
 * A handful of end-to-end flows, not a component suite. The pure logic is
 * covered far more cheaply by Vitest; what only a real browser can tell us is
 * whether the app boots, persists, and survives being offline.
 *
 * Run against the built output rather than the dev server, so the service
 * worker under test is the one that ships.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // A phone-shaped Chromium. The iPhone device profile would be a better
    // match for the target hardware, but it selects WebKit, which this
    // environment does not ship; borrowing its viewport keeps the layout
    // honest without pulling in a browser that is not here.
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: false,
    hasTouch: true,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--no-sandbox'],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @botc/storyteller exec vite preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @botc/player exec vite preview --port 4174',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
