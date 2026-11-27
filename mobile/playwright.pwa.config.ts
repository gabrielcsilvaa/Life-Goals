import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./pwa-e2e",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  outputDir: "../artifacts/pwa-tests",
  use: {
    baseURL: "http://127.0.0.1:8091",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "node scripts/serve-pwa.mjs",
    url: "http://127.0.0.1:8091",
    reuseExistingServer: false,
    env: { PWA_TEST_HARNESS: "1" },
  },
});
