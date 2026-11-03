import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://localhost:3100";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      grep: /@mobile/,
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        // CI builds in a dedicated step; locally build first so tests hit fresh code.
        command: isCI ? "npm run start -- -p 3100" : "npm run build && npm run start -- -p 3100",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
        env: {
          DATA_DIR: ".e2e-data",
          // Fixed, test-only key. Never use it for real data.
          CREDZO_ENCRYPTION_KEY: "ZTJlLXRlc3Qta2V5LWRvLW5vdC11c2UtaW4tcHJvZCE=",
          COOKIE_SECURE: "false",
          // Specs give each test its own X-Forwarded-For address to keep rate limits apart.
          TRUST_PROXY: "1",
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
