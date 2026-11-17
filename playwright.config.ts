import { defineConfig } from "@playwright/test";

// Extensions need a persistent Chromium context (see tests/e2e/fixtures.ts).
// Headless by default; HEADLESS=0 shows the browser (needs WSLg on Windows 11).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]]
});
