import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
        navigationTimeout: 30_000,
    },
    expect: {
        // The dev server compiles routes on demand and the suite runs many
        // workers in parallel; content-backed assertions need more room than
        // the 5s default.
        timeout: 15_000,
    },
    projects: [
        {
            name: "setup",
            testMatch: /.*\.setup\.ts/,
            use: {
                headless: false,
            },
        },
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "e2e/.auth/user.json",
                ...(process.env.CI ? {} : { channel: "chromium" }),
            },
            dependencies: ["setup"],
        },
    ],
    webServer: {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        env: {
            NODE_ENV: "test",
        },
    },
});
