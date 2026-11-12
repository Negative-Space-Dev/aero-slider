import { defineConfig, devices } from "@playwright/test";

// Overridable so test runs in two worktrees on one machine don't collide.
const port = Number(process.env.TEST_PORT ?? 4174);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "test",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `bun ./test/server.ts ${port}`,
    url: `http://localhost:${port}/dist/aero-slider.min.js`,
    // Never reuse: a server left by another worktree would serve that checkout's dist/.
    reuseExistingServer: false,
  },
});
