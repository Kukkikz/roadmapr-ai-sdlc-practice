import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Dedicated database so e2e never touches the developer's .data/pglite.
const E2E_DB_DIR = ".data/e2e-pglite";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx scripts/e2e-setup.mts && npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      SESSION_SECRET: "e2e-only-session-secret-at-least-32-chars",
      PGLITE_DATA_DIR: E2E_DB_DIR,
    },
    timeout: 120_000,
  },
});
