import type { Page } from "@playwright/test";

export const TEST_REPO = process.env.E2E_TEST_REPO ?? "neosrc-labs/test-repo";
export const [OWNER, REPO] = TEST_REPO.split("/") as [string, string];
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function gotoPr(page: Page, prNumber: number) {
    await page.goto(`/gh/${OWNER}/${REPO}/pull/${prNumber}`);
    await page.waitForLoadState("networkidle");
}

export async function collapseRightSidebar(page: Page) {
    await page.getByTitle("Close right sidebar").click();
}

export async function expandRightSidebar(page: Page) {
    await page.getByTitle("Open right sidebar").click();
}

export async function collapseLeftSidebar(page: Page) {
    const dragHandle = page.locator(".cursor-col-resize").first();
    const box = await dragHandle.boundingBox();
    if (!box) throw new Error("Could not find left sidebar drag handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 300, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
}

export async function expandLeftSidebar(page: Page) {
    await page.locator('button[title="Open left sidebar"]').click();
}
