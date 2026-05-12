import { defineConfig, devices } from '@playwright/test';

/**
 * Nestle Connect — Playwright Configuration
 *
 * baseURL points at the Express backend that serves both the API and the
 * static frontend HTML files (port 5000 as set in backend/.env).
 *
 * The webServer block starts the backend automatically before the test
 * run begins, so you don't need to manually start the server first.
 */
export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallelism on CI; use all available workers locally */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: 'html',

  use: {
    /**
     * Base URL so that page.goto('/login.html') resolves to
     * http://localhost:5000/login.html (served by the Express backend).
     */
    baseURL: 'http://localhost:5000',

    /* Collect a trace when a test fails for the first time — useful for debugging */
    trace: 'on-first-retry',

    /* Take a screenshot automatically on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      /* Primary: Chromium (fastest; use this for local dev) */
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Uncomment to run cross-browser during CI / final regression */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /**
   * Start the Express backend before the test suite runs.
   * Playwright waits until http://localhost:5000 responds before
   * dispatching any test, and shuts the server down afterwards.
   *
   * IMPORTANT: make sure the backend is NOT already running on port 5000
   * when you execute `npx playwright test`, or this block will be skipped
   * (reuseExistingServer: true handles that gracefully).
   */
  webServer: {
    /**
     * Run from the backend directory so that `require("dotenv").config()`
     * finds `backend/.env` correctly (dotenv resolves .env relative to cwd).
     * On Windows, PowerShell-style chaining: push into backend dir, run server.
     */
    command: 'cd backend && node server.js',
    url: 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
