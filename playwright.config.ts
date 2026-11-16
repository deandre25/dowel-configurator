import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  /**
   * Two at a time locally, one in CI.
   *
   * Each of these tests drives a page that loads Three.js and an environment
   * map and runs WebGL — in a headless browser that has no GPU and rasterises
   * in software. Four of them at once saturated the machine and the failures
   * were timeouts on assertions whose text was already on screen by the time
   * the snapshot was taken. The contention was the test harness's, not the
   * application's.
   */
  workers: process.env.CI ? 1 : 2,
  expect: {
    // A change is debounced, then priced by the server over the network, on a
    // page that is also drawing. Five seconds is not generous enough to be
    // meaningful here.
    timeout: 15_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // When PLAYWRIGHT_BASE_URL points elsewhere, the tests run against that
  // deployment and no local server is started.
  ...(process.env.PLAYWRIGHT_BASE_URL === undefined
    ? {
        webServer: {
          command: `npx next start --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
