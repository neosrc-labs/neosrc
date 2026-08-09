// CJS config — the next/experimental/testmode/playwright module is CJS-only.
// Its defineConfig merges the defaultPlaywrightConfig (which includes firefox + webkit
// projects) with the user config.  Pass --project=chromium when running to select only
// the browser that has system deps installed.
const { defineConfig } = require("next/experimental/testmode/playwright");
const { devices } = require("@playwright/test");

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
    testDir: "./src/__tests__/functional",
    testMatch: "**/*.spec.cjs",
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
        navigationTimeout: 10_000,
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                ...(process.env.CI ? {} : { channel: "chromium" }),
            },
        },
    ],
    webServer: {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        env: {
            NODE_ENV: "test",
            NEXT_TEST_PROXY: "true",
        },
    },
});
