import { defineConfig } from "@playwright/test";

/**
 * Extension behaviour runs against a stub of github.com and neosrc.dev served
 * on loopback, so it needs no app build, database or network access. Chromium
 * (not the headless shell) is required: extensions do not load otherwise.
 */
export default defineConfig({
    testDir: "./extension/test",
    fullyParallel: false,
    workers: 1,
    timeout: 90_000,
    reporter: "list",
    use: { ignoreHTTPSErrors: true },
});
