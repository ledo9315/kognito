import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.playwright/user.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|[/\\]anonymous[/\\]/,
    },
    {
      // Everything about being signed out, or about signing in as somebody
      // else, runs here: no stored session.
      name: 'anonymous',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /[/\\]anonymous[/\\]/,
    },
  ],
  webServer: {
    // CI tests the production build. Locally the dev server is used instead:
    // a reused `next start` keeps serving the build it was started with, so
    // code changes silently do not reach the test run.
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
