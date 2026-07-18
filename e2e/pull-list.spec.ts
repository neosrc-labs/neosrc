import { expect, test } from "@playwright/test";
import { TEST_REPO } from "./shared/helpers";

test.describe("Pull request list", { tag: ["@github"] }, () => {
    test("loads the pull request list page", async ({ page }) => {
        await test.step("Navigate to the pull requests list page", async () => {
            await page.goto(`/${TEST_REPO}/pulls`);
        });

        await test.step("Verify the page title contains 'pulls'", async () => {
            await expect(page).toHaveTitle(/pulls/i);
        });

        await test.step("Verify the search input is visible", async () => {
            await expect(
                page.getByRole("textbox", { name: /search pull requests/i }),
            ).toBeVisible();
        });

        await test.step("Verify the open-state filter button is visible", async () => {
            await expect(
                page.getByRole("button", { name: "Open", exact: true }),
            ).toBeVisible();
        });
    });
});
