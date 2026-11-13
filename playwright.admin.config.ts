import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_ADMIN_PORT ?? 3200);

// Admin end-to-end tests. They need the LOCAL Supabase stack
// (`npm run db:start`) and run the app against it through
// scripts/with-local-supabase.sh, which refuses any hosted project.
export default defineConfig({
  testDir: "./e2e-admin",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-admin" }]] : "list",
  globalSetup: "./e2e-admin/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `PAYMENTS_PROVIDER=mock scripts/with-local-supabase.sh npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/en/admin/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
