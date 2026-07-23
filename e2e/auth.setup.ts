import fs from "node:fs";
import path from "node:path";
import { chromium, test as setup } from "@playwright/test";

const AUTH_FILE = path.join(import.meta.dirname, ".auth", "user.json");

setup("authenticate", async ({ browser }) => {
    if (fs.existsSync(AUTH_FILE)) {
        const headless = await chromium.launch({ headless: true });
        try {
            const context = await headless.newContext({
                storageState: AUTH_FILE,
            });
            const page = await context.newPage();
            await page.goto("/profile");
            await page.waitForLoadState("networkidle");
            if (page.url().includes("/profile")) {
                await context.close();
                await headless.close();
                return;
            }
            await context.close();
        } catch {
            // Session expired — re-authenticate
        }
        await headless.close();
        fs.unlinkSync(AUTH_FILE);
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");

    console.log("\n========================================");
    console.log("  AUTHENTICATION REQUIRED");
    console.log("  Please sign in with GitHub in the");
    console.log("  browser window that just opened.");
    console.log("========================================\n");

    await page
        .getByRole("heading", { name: /welcome/i })
        .waitFor({ timeout: 300_000 });

    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    await page.context().storageState({ path: AUTH_FILE });
    await context.close();

    console.log("\nAuthentication saved for future test runs.\n");
});
