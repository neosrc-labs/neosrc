import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";
import {
    createTestChangesPullRequest,
    type TestChangesPullRequest,
} from "./shared/data";
import { GITHUB_TOKEN, OWNER, REPO } from "./shared/helpers";

test.describe
    .serial("Pull request changes", { tag: ["@github"] }, () => {
        let testPullRequest: TestChangesPullRequest;

        test.beforeAll(async () => {
            test.skip(
                !GITHUB_TOKEN,
                "GITHUB_TOKEN not set - skipping API-based test",
            );

            testPullRequest = await createTestChangesPullRequest();
        });

        test.afterAll(async () => {
            if (!GITHUB_TOKEN || !testPullRequest?.number) return;

            const octokit = new Octokit({ auth: GITHUB_TOKEN });
            try {
                await octokit.rest.pulls.update({
                    owner: OWNER,
                    repo: REPO,
                    pull_number: testPullRequest.number,
                    state: "closed",
                });
            } catch {
                // Best-effort cleanup
            }
        });

        test("should render the changes header data", async ({ page }) => {
            await page.goto(
                `/gh/${OWNER}/${REPO}/pull/${testPullRequest.number}/changes`,
            );
            await page.waitForLoadState("networkidle");
            const changesHeader = page.locator("div.sticky").first();
            await test.step("Verify the PR title", async () => {
                await expect(
                    page.getByRole("heading", {
                        level: 2,
                        name: testPullRequest.title,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the PR author", async () => {
                await expect(
                    page.getByText(testPullRequest.authorLogin, {
                        exact: true,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the base and head branches", async () => {
                await expect(
                    page.getByRole("link", {
                        name: testPullRequest.baseBranch,
                        exact: true,
                    }),
                ).toBeVisible();
                await expect(
                    page.getByRole("link", {
                        name: testPullRequest.headBranch,
                        exact: true,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the additions and deletions", async () => {
                await expect(
                    changesHeader.getByText(`+${testPullRequest.additions}`, {
                        exact: true,
                    }),
                ).toBeVisible();
                await expect(
                    changesHeader.getByText(`-${testPullRequest.deletions}`, {
                        exact: true,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the files viewed count", async () => {
                await expect(
                    changesHeader.getByText(
                        `0/${testPullRequest.files.length} files viewed`,
                        { exact: true },
                    ),
                ).toBeVisible();
            });
        });

        test("should render the file tree data", async ({ page }) => {
            await page.goto(
                `/gh/${OWNER}/${REPO}/pull/${testPullRequest.number}/changes`,
            );
            await page.waitForLoadState("networkidle");

            const leftSidebar = page.getByTestId("left-sidebar");

            await test.step("Verify the changed file count", async () => {
                await expect(
                    leftSidebar.getByRole("heading", {
                        name: `Files Changed (${testPullRequest.changedFiles})`,
                    }),
                ).toBeVisible();
                await expect(
                    leftSidebar.locator('a[href*="/changes#"]'),
                ).toHaveCount(testPullRequest.files.length);
            });

            await test.step("Verify each file and its status color", async () => {
                for (const file of testPullRequest.files) {
                    const fileLink = leftSidebar.getByRole("link", {
                        name: file.filename,
                        exact: true,
                    });
                    await expect(fileLink).toBeVisible();

                    const fileName = fileLink.getByText(file.filename, {
                        exact: true,
                    });
                    if (file.status === "added") {
                        await expect(fileName).toHaveClass(/text-green-500/);
                    } else if (file.status === "modified") {
                        await expect(fileName).toHaveClass(/text-white/);
                    }
                }
            });
        });
        test("should support editing reacting to and deleting a single comment", async ({
            page,
        }) => {
            const commentFile = testPullRequest.files.find(
                (file) => file.status === "modified",
            );
            if (!commentFile) throw new Error("Test PR has no modified file");

            await page.goto(
                `/gh/${OWNER}/${REPO}/pull/${testPullRequest.number}/changes`,
            );
            await page.waitForLoadState("networkidle");

            const fileDiff = page.locator(
                `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
            );
            const commentText = `Single comment ${Date.now()}`;
            const editedCommentText = `${commentText} edited`;

            await test.step("Add a single line comment", async () => {
                const line = fileDiff.locator("tr:has(td.d2h-ins)").first();
                await line.hover();
                await line.locator("td.d2h-code-linenumber svg").click();
                await fileDiff
                    .getByPlaceholder("Add a comment...")
                    .fill(commentText);
                await fileDiff
                    .getByRole("button", { name: "Add single comment" })
                    .click();
            });

            const thread = fileDiff
                .locator('[id^="review-thread-"]')
                .filter({ hasText: commentText });
            await test.step("Verify the comment was added", async () => {
                await expect(thread).toBeVisible();
            });

            await test.step("Edit the comment", async () => {
                await thread
                    .getByRole("button", { name: "Edit comment" })
                    .click();
                await thread.locator("textarea").fill(editedCommentText);
                await thread.getByRole("button", { name: "Save" }).click();
                await expect(thread.getByText(editedCommentText)).toBeVisible();
            });

            await test.step("Add a reaction to the comment", async () => {
                await thread
                    .locator('button[aria-label="Add reaction"]')
                    .click();
                await page
                    .locator("[data-radix-popper-content-wrapper]")
                    .locator('button[aria-label="+1"]')
                    .click();
                await expect(
                    thread.locator('button[aria-label$="(1)"]'),
                ).toBeVisible();
            });

            await test.step("Delete the comment", async () => {
                await thread
                    .getByRole("button", { name: "More options" })
                    .click();
                await page
                    .locator("[data-radix-popper-content-wrapper]")
                    .getByRole("button", { name: "Delete comment" })
                    .click();
                const dialog = page.getByRole("dialog");
                await expect(dialog).toBeVisible();
                await dialog.getByRole("button", { name: "Delete" }).click();
                await expect(thread).not.toBeAttached();
            });
        });
    });
