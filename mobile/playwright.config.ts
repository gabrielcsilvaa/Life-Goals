import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  workers: 1,
  reporter: "list",
  outputDir: process.env.LIFEGOALS_TEST_API
    ? "../artifacts/playwright-live"
    : "../artifacts/playwright",
  use: {
    baseURL: "http://127.0.0.1:8081",
    browserName: "chromium",
    channel: "msedge",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx expo start --web --port 8081 --localhost",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: true,
    timeout: 120000,
    env: { CI: "1" },
  },
});
