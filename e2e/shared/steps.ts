import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { gotoPr } from "./helpers";

export async function navigateToPr(page: Page, prNumber: number) {
    await test.step("Navigate to the pull request page", async () => {
        await gotoPr(page, prNumber);
    });
}
