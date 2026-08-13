import { Octokit } from "@octokit/rest";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
    createTestChangesPullRequest,
    type TestChangesPullRequest,
} from "./shared/data";
import { GITHUB_TOKEN, gotoChanges, OWNER, REPO } from "./shared/helpers";

async function runReplyPromotionScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const commentFile = testPullRequest.files.find(
        (file) => file.status === "modified",
    );
    if (!commentFile) throw new Error("Test PR has no modified file");

    await gotoChanges(page, testPullRequest.number);

    const fileDiff = page.locator(
        `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
    );
    const parentText = `Parent comment ${Date.now()}`;
    const replyText = `Reply comment ${Date.now()}`;
    const editedReplyText = `${replyText} edited`;

    await test.step("Add a parent comment", async () => {
        const line = fileDiff.locator("tr:has(td.d2h-ins)").first();
        await line.hover();
        await line.locator("td.d2h-code-linenumber svg").click();
        await fileDiff.getByPlaceholder("Add a comment...").fill(parentText);
        await fileDiff
            .getByRole("button", { name: "Add single comment" })
            .click();
    });

    let thread = fileDiff
        .locator('[id^="review-thread-"]')
        .filter({ hasText: parentText });
    await expect(thread).toBeVisible();
    await expect(
        thread.getByText("Saving...", { exact: true }),
    ).not.toBeAttached({ timeout: 15_000 });

    await test.step("Add a reply to the comment", async () => {
        await thread.getByRole("button", { name: "Reply..." }).click();
        await thread.getByPlaceholder("Write a reply...").fill(replyText);
        await thread
            .getByRole("button", { name: "Reply", exact: true })
            .click();
        await expect(thread.getByText(replyText)).toBeVisible();
    });

    const replyBody = thread.getByText(replyText, { exact: true });
    const replyCard = replyBody.locator(
        "xpath=ancestor::div[contains(@class, 'relative')][1]",
    );

    await test.step("Update the reply", async () => {
        await replyCard.getByRole("button", { name: "Edit comment" }).click();
        await replyCard.locator("textarea").fill(editedReplyText);
        const updateResponse = page.waitForResponse((response) =>
            response.url().includes("reviewComments.update"),
        );
        await thread.getByRole("button", { name: "Save" }).click();
        const response = await updateResponse;
        expect(response.status()).toBe(200);
        await expect(thread.getByText(editedReplyText)).toBeVisible();
    });

    await test.step("Delete the parent comment", async () => {
        const parentCard = thread
            .getByText(parentText, { exact: true })
            .locator("xpath=ancestor::div[contains(@class, 'relative')][1]");
        await parentCard.getByRole("button", { name: "More options" }).click();
        await page
            .locator("[data-radix-popper-content-wrapper]")
            .getByRole("button", { name: "Delete comment" })
            .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const deleteResponse = page.waitForResponse((response) =>
            response.url().includes("reviewComments.delete"),
        );
        await dialog.getByRole("button", { name: "Delete" }).click();
        const response = await deleteResponse;
        expect(response.status()).toBe(200);
    });
    await page.reload();

    thread = fileDiff
        .locator('[id^="review-thread-"]')
        .filter({ hasText: editedReplyText });
    await test.step("Verify the reply became the parent", async () => {
        await expect(thread).toBeVisible();
        const promotedReplyCard = thread
            .getByText(editedReplyText, { exact: true })
            .locator("xpath=ancestor::div[contains(@class, 'relative')][1]");
        await expect(promotedReplyCard).toHaveClass(/border-b-1/);
    });

    await test.step("Resolve the comment thread", async () => {
        const resolveResponse = page.waitForResponse((response) =>
            response.url().includes("reviewComments.resolveThread"),
        );
        await thread
            .getByRole("button", { name: "Resolve", exact: true })
            .click();
        const response = await resolveResponse;
        expect(response.status()).toBe(200);
        await expect(
            fileDiff.getByRole("button", { name: "Show thread" }),
        ).toBeVisible();
    });
}
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
            await gotoChanges(page, testPullRequest.number);
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
            await gotoChanges(page, testPullRequest.number);

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

            await gotoChanges(page, testPullRequest.number);

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
        test("should support updating and submitting a review comment", async ({
            page,
        }) => {
            const commentFile = testPullRequest.files.find(
                (file) => file.status === "modified",
            );
            if (!commentFile) throw new Error("Test PR has no modified file");

            await gotoChanges(page, testPullRequest.number);

            const fileDiff = page.locator(
                `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
            );
            const commentText = `Review comment ${Date.now()}`;
            const editedCommentText = `${commentText} edited`;

            await test.step("Add a comment as a review", async () => {
                const line = fileDiff.locator("tr:has(td.d2h-ins)").first();
                await line.hover();
                await line.locator("td.d2h-code-linenumber svg").click();
                await fileDiff
                    .getByPlaceholder("Add a comment...")
                    .fill(commentText);
                const startReviewResponse = page.waitForResponse(
                    (response) =>
                        response.url().includes("reviews.start") &&
                        response.ok(),
                );
                const createCommentResponse = page.waitForResponse(
                    (response) =>
                        response.url().includes("reviewComments.create") &&
                        response.ok(),
                );
                await fileDiff
                    .getByRole("button", { name: "Start a Review" })
                    .click();
                await Promise.all([startReviewResponse, createCommentResponse]);
            });

            const thread = fileDiff
                .locator('[id^="review-thread-"]')
                .filter({ hasText: commentText });
            await test.step("Verify the review comment is pending", async () => {
                await expect(thread).toBeVisible();
                await expect(
                    thread.getByText("Pending", { exact: true }),
                ).toBeVisible();
                await expect(
                    thread.getByText("Saving...", { exact: true }),
                ).not.toBeAttached({ timeout: 15_000 });
            });

            await test.step("Update the pending review comment", async () => {
                await thread
                    .getByRole("button", { name: "Edit comment" })
                    .click();
                await thread.locator("textarea").fill(editedCommentText);
                const updateResponse = page.waitForResponse((response) =>
                    response.url().includes("reviewComments.update"),
                );
                await thread.getByRole("button", { name: "Save" }).click();
                const updateResult = await updateResponse;
                expect(updateResult.status()).toBe(200);
                await expect(thread.getByText(editedCommentText)).toBeVisible();
            });
            await test.step("Submit the review", async () => {
                await page
                    .getByRole("button", { name: /Submit Review/ })
                    .last()
                    .click();
                const reviewPopover = page.locator(
                    "[data-radix-popper-content-wrapper]",
                );
                await reviewPopover
                    .getByPlaceholder("Leave a review comment")
                    .fill(`Review submission ${Date.now()}`);
                const submitResponse = page.waitForResponse((response) =>
                    response.url().includes("reviews.submit"),
                );
                await reviewPopover
                    .getByRole("button", { name: "Comment", exact: true })
                    .click();
                await submitResponse;
            });

            await test.step("Verify the submitted comment is no longer pending", async () => {
                await gotoChanges(page, testPullRequest.number);
                const submittedThread = fileDiff
                    .locator('[id^="review-thread-"]')
                    .filter({ hasText: commentText });
                await expect(submittedThread).toBeVisible();
                await expect(
                    submittedThread.getByText("Pending", { exact: true }),
                ).not.toBeAttached({ timeout: 15_000 });
            });
        });
        test("should promote replies and resolve the comment thread", async ({
            page,
        }) => {
            await runReplyPromotionScenario(page, testPullRequest);
        });
    });
