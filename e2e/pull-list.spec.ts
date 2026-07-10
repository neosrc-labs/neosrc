import { expect, test } from "@playwright/test";

const TEST_REPO = process.env.E2E_TEST_REPO ?? "neosrc-labs/test-repo";

test.describe("Pull request list", () => {
    test("loads the pull request list page", async ({ page }) => {
        await page.goto(`/${TEST_REPO}/pulls`);

        await expect(page).toHaveTitle(/pulls/i);
        await expect(
            page.getByRole("textbox", { name: /search pull requests/i }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Open", exact: true }),
        ).toBeVisible();
    });
});
