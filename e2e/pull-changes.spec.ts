import { Octokit } from "@octokit/rest";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
    createTestChangesPullRequest,
    GAP_FIXTURE_PATH,
    type TestChangesPullRequest,
} from "./shared/data";
import { GITHUB_TOKEN, gotoChanges, OWNER, REPO } from "./shared/helpers";

/**
 * Switch every file diff to the requested view and wait for the toggle to
 * stick. The view switch lives behind the settings gear; a click dispatched
 * before React hydrates the page is silently lost (no handler is attached
 * yet), so the sequence is retried until the menu item reports the requested
 * mode.
 */
async function clickViewMode(page: Page, mode: "Unified" | "Split") {
    await expect(async () => {
        await page.getByRole("button", { name: "Diff settings" }).click();
        const item = page.getByRole("menuitemradio", {
            name: mode,
            exact: true,
        });
        await item.click({ timeout: 2_000 });
        await expect(item).toHaveAttribute("aria-checked", "true", {
            timeout: 2_000,
        });
    }).toPass({ timeout: 15_000 });
}

/** Switch every file diff to the split view and wait for the toggle to stick. */
async function setSplitView(page: Page) {
    await clickViewMode(page, "Split");
}

/**
 * A modified file with a single 1:1 replacement (it has a paired deletion
 * and insertion row, so both sides exist for commenting). The multi-hunk gap
 * fixture is avoided here because its first changed row is an unpaired
 * insertion without an old side.
 */
function findCommentFile(
    files: TestChangesPullRequest["files"],
): TestChangesPullRequest["files"][number] | undefined {
    return (
        files.find(
            (file) =>
                file.status === "modified" &&
                file.filename !== GAP_FIXTURE_PATH,
        ) ?? files.find((file) => file.status === "modified")
    );
}

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
    const { data: me } = await new Octokit({
        auth: GITHUB_TOKEN,
    }).rest.users.getAuthenticated();

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

        const resolvedThread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: /marked this conversation as resolved/ });
        await expect(resolvedThread).toBeVisible();
        await expect(
            resolvedThread.getByText(
                `${me.login} marked this conversation as resolved`,
            ),
        ).toBeVisible();

        // Banner styled like a comment card: capped at the 800px column.
        const banner = resolvedThread.locator("div.max-w-\\[800px\\]").first();
        const bannerBox = await banner.boundingBox();
        expect(bannerBox?.width ?? 0).toBeLessThanOrEqual(800);

        // Show thread is right-aligned inside the banner.
        const showThread = resolvedThread.getByRole("button", {
            name: "Show thread",
        });
        await expect(showThread).toBeVisible();
        const showBox = await showThread.boundingBox();
        const gapFromRightEdge =
            (bannerBox?.x ?? 0) +
            (bannerBox?.width ?? 0) -
            ((showBox?.x ?? 0) + (showBox?.width ?? 0));
        expect(
            gapFromRightEdge,
            "Show thread should sit right-aligned within the banner's padding",
        ).toBeGreaterThanOrEqual(2);
        expect(gapFromRightEdge).toBeLessThanOrEqual(16);
    });

    await test.step("Collapse and re-expand the resolved thread", async () => {
        // Expand from the banner.
        await fileDiff.getByRole("button", { name: "Show thread" }).click();
        const expandedThread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: editedReplyText });
        await expect(expandedThread.getByText(editedReplyText)).toBeVisible();

        // Collapse lives in the parent card header, left of the action
        // cluster (the role badge sits between it and edit/more options).
        const collapse = expandedThread.getByRole("button", {
            name: "Collapse",
        });
        await expect(collapse).toBeVisible();
        const collapseBox = await collapse.boundingBox();
        const moreBox = await expandedThread
            .getByRole("button", { name: "More options" })
            .boundingBox();
        expect(
            Math.abs((collapseBox?.y ?? 0) - (moreBox?.y ?? 0)),
            "Collapse should sit in the same header row as the comment actions",
        ).toBeLessThanOrEqual(4);
        expect(
            (collapseBox?.x ?? 0) + (collapseBox?.width ?? 0),
            "Collapse should sit left of the header action cluster",
        ).toBeLessThanOrEqual(moreBox?.x ?? 0);

        // The thread's line-number section carries the anchored line's
        // lighter shade (continuation) and the separator border is gone.
        const threadLn = expandedThread.locator("xpath=ancestor::tr[1]/td[1]");
        await expect(threadLn).toHaveClass(/d2h-thread-ln/);
        // Locate the anchored line row by content (other tests may have
        // left sibling threads on the same line, so preceding-sibling
        // would resolve to another thread row).
        const lineRow = fileDiff
            .locator('tbody tr[id^="diff-"]:has(td.d2h-ins)')
            .first();
        const lineLn = lineRow.locator("td.d2h-code-linenumber").first();
        expect(
            await threadLn.evaluate(
                (el) => getComputedStyle(el).backgroundColor,
            ),
        ).toBe(
            await lineLn.evaluate((el) => getComputedStyle(el).backgroundColor),
        );
        expect(
            await lineLn.evaluate(
                (el) => getComputedStyle(el).borderRightWidth,
            ),
            "no vertical separator between line numbers and content",
        ).toBe("0px");
        expect(
            await lineLn.evaluate((el) => getComputedStyle(el).borderLeftWidth),
            "no border on the outer edge of the line numbers",
        ).toBe("0px");

        // Collapse back to the banner.
        await collapse.click();
        await expect(
            fileDiff.getByText(
                `${me.login} marked this conversation as resolved`,
            ),
        ).toBeVisible();

        // Re-expand still works.
        await fileDiff.getByRole("button", { name: "Show thread" }).click();
        await expect(
            fileDiff
                .locator('[id^="review-thread-"]')
                .filter({ hasText: editedReplyText })
                .getByText(editedReplyText),
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
                const reactionResponse = page.waitForResponse((response) =>
                    response
                        .url()
                        .includes("reactions.togglePullRequestReviewComment"),
                );
                await page
                    .locator("[data-radix-popper-content-wrapper]")
                    .locator('button[aria-label="+1"]')
                    .click();
                const response = await reactionResponse;
                expect(response.status()).toBe(200);
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
                await expect(thread).toBeVisible({ timeout: 15_000 });
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
            test.setTimeout(120_000);
            await runReplyPromotionScenario(page, testPullRequest);
        });

        test("should toggle between unified and split diff views", async ({
            page,
        }) => {
            await runToggleViewScenario(page, testPullRequest);
        });
        test("should render added files with an empty old side in split view", async ({
            page,
        }) => {
            await runAddedFileSplitScenario(page, testPullRequest);
        });
        test("should render modified lines paired across sides in split view", async ({
            page,
        }) => {
            await runPairedRowSplitScenario(page, testPullRequest);
        });
        test("should add a comment in split view from the new side", async ({
            page,
        }) => {
            await runNewSideCommentScenario(page, testPullRequest);
        });
        test("should add a comment in split view from the old side", async ({
            page,
        }) => {
            await runOldSideCommentScenario(page, testPullRequest);
        });
        test("should drag a multi-line comment range in split view", async ({
            page,
        }) => {
            await runDragRangeCommentScenario(page, testPullRequest);
        });
        test("should expand a collapsed gap in split view with matching old numbers", async ({
            page,
        }) => {
            await runGapExpansionScenario(page, testPullRequest);
        });
        test("should persist the split view preference across reloads", async ({
            page,
        }) => {
            await runPreferencePersistenceScenario(page, testPullRequest);
        });
    });

async function runToggleViewScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    await gotoChanges(page, testPullRequest.number);

    await test.step("Verify the unified view is the default", async () => {
        await expect(
            page.locator("table.d2h-diff-table:not(.d2h-split-table)").first(),
        ).toBeVisible();
    });

    await test.step("Switch to split view", async () => {
        await setSplitView(page);
        await expect(
            page.locator("table.d2h-split-table").first(),
        ).toBeVisible();
    });

    await test.step("Switch back to unified view", async () => {
        await clickViewMode(page, "Unified");
        await expect(
            page.locator("table.d2h-diff-table:not(.d2h-split-table)").first(),
        ).toBeVisible();
    });
}

async function runAddedFileSplitScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const addedFile = testPullRequest.files.find(
        (file) => file.status === "added",
    );
    if (!addedFile) throw new Error("Test PR has no added file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${addedFile.filename.replace(/\//g, "-")}"]`,
    );
    await expect(fileDiff.locator("table.d2h-split-table")).toBeVisible();

    await test.step("Verify the added line renders on the new side only", async () => {
        const row = fileDiff.locator('tbody tr[id^="diff-"]').first();
        await expect(row.locator("td")).toHaveCount(4);
        await expect(row).toHaveAttribute("data-new-line", "1");
        // The old side is neutral: empty line-number and code cells.
        await expect(
            row.locator("td.d2h-code-linenumber.d2h-split-ln.d2h-empty-side"),
        ).toHaveCount(1);
        await expect(
            row.locator("td.d2h-split-code.d2h-empty-side"),
        ).toHaveCount(1);
        await expect(
            row.locator("td.d2h-split-ln.d2h-split-new .d2h-split-ln-num"),
        ).toHaveText("1");
        await expect(row.locator("td.d2h-split-code").last()).toContainText(
            "E2E Changes Test",
        );
    });
}

async function runPairedRowSplitScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const commentFile = findCommentFile(testPullRequest.files);
    if (!commentFile) throw new Error("Test PR has no modified file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
    );
    await expect(fileDiff.locator("table.d2h-split-table")).toBeVisible();

    await test.step("Verify the changed line has both sides on one row", async () => {
        const changedRow = fileDiff
            .locator('tbody tr[id^="diff-"]:has(td.d2h-ins)')
            .first();
        await expect(changedRow.locator("td")).toHaveCount(4);
        // A 1:1 replacement pairs the deleted and added lines: both
        // code cells carry content and the old/new numbers match.
        await expect(
            changedRow.locator("td.d2h-split-code.d2h-del"),
        ).toHaveCount(1);
        await expect(
            changedRow.locator("td.d2h-split-code.d2h-ins"),
        ).toHaveCount(1);
        const oldNum = await changedRow
            .locator("td.d2h-split-ln:not(.d2h-split-new) .d2h-split-ln-num")
            .textContent();
        const newNum = await changedRow
            .locator("td.d2h-split-ln.d2h-split-new .d2h-split-ln-num")
            .textContent();
        expect(oldNum?.trim()).toBe(newNum?.trim());
        await expect(changedRow).toHaveAttribute(
            "data-old-line",
            oldNum?.trim() ?? "",
        );
        await expect(changedRow).toHaveAttribute(
            "data-new-line",
            newNum?.trim() ?? "",
        );
    });
}

async function runNewSideCommentScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const commentFile = findCommentFile(testPullRequest.files);
    if (!commentFile) throw new Error("Test PR has no modified file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
    );
    const commentText = `Split comment ${Date.now()}`;

    await test.step("Add a comment on the new side of the changed line", async () => {
        const line = fileDiff
            .locator('tbody tr[id^="diff-"]:has(td.d2h-ins)')
            .first();
        // Only the hovered side shows its plus button.
        await line.locator("td.d2h-split-ln.d2h-split-new").hover();
        await line.locator("td.d2h-split-ln.d2h-split-new svg").click();
        await fileDiff.getByPlaceholder("Add a comment...").fill(commentText);
        await fileDiff
            .getByRole("button", { name: "Add single comment" })
            .click();
    });

    await test.step("Verify the comment thread appears", async () => {
        const thread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: commentText });
        await expect(thread).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Verify the comment card is capped at 800px", async () => {
        const card = fileDiff
            .locator('[class*="max-w-[800px]"]')
            .filter({ hasText: commentText })
            .first();
        await expect(card).toBeVisible();
        const box = await card.boundingBox();
        expect(
            box?.width ?? 0,
            "comment card should not exceed the 800px reading width",
        ).toBeLessThanOrEqual(800);

        // The reply affordance must sit inside the comment card's column
        // rather than stretching across the diff table.
        const thread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: commentText });
        const reply = thread.getByRole("button", { name: "Reply..." });
        await expect(reply).toBeVisible();
        const replyBox = await reply.boundingBox();
        expect(replyBox?.x ?? 0).toBeGreaterThanOrEqual(box?.x ?? 0);
        expect(
            (replyBox?.x ?? 0) + (replyBox?.width ?? 0),
            "reply button should not extend past the comment card",
        ).toBeLessThanOrEqual((box?.x ?? 0) + 800);
    });

    await test.step("Verify the line-number shade continues into the thread", async () => {
        const thread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: commentText });
        const threadRow = thread.locator("xpath=ancestor::tr[1]");
        const threadLn = threadRow.locator("td.d2h-split-ln.d2h-ins").first();
        await expect(threadLn).toBeVisible();

        // The comment's line-number section uses the anchored line's shade
        // family. The line row itself may carry a transient selection
        // highlight, so compare by class rather than computed color.
        const lineRow = fileDiff
            .locator('tbody tr[id^="diff-"]:has(td.d2h-ins)')
            .first();
        const lineLn = lineRow.locator("td.d2h-split-ln.d2h-split-new");
        await expect(threadLn).toHaveClass(/d2h-ins/);
        await expect(lineLn).toHaveClass(/d2h-ins/);

        // The thread's number shade is lighter than the content tint, and
        // the diff2html separator border between numbers and content is gone.
        const threadLnBg = await threadLn.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        const codeBg = await lineRow
            .locator("td.d2h-split-code.d2h-ins")
            .evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(
            threadLnBg,
            "number shade should differ from the content tint",
        ).not.toBe(codeBg);
        expect(
            await lineLn.evaluate(
                (el) => getComputedStyle(el).borderRightWidth,
            ),
            "no vertical separator between line numbers and content",
        ).toBe("0px");
        expect(
            await lineLn.evaluate((el) => getComputedStyle(el).borderLeftWidth),
            "no border on the outer edge of the line numbers",
        ).toBe("0px");
    });
}

async function runOldSideCommentScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const commentFile = findCommentFile(testPullRequest.files);
    if (!commentFile) throw new Error("Test PR has no modified file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${commentFile.filename.replace(/\//g, "-")}"]`,
    );
    const commentText = `Split old-side comment ${Date.now()}`;

    await test.step("Add a comment on the old side of the changed line", async () => {
        const line = fileDiff
            .locator('tbody tr[id^="diff-"]:has(td.d2h-ins)')
            .first();
        await line.locator("td.d2h-split-ln:not(.d2h-split-new)").hover();
        await line.locator("td.d2h-split-ln:not(.d2h-split-new) svg").click();
        await fileDiff.getByPlaceholder("Add a comment...").fill(commentText);
        await fileDiff
            .getByRole("button", { name: "Add single comment" })
            .click();
    });

    await test.step("Verify the comment thread appears", async () => {
        const thread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: commentText });
        await expect(thread).toBeVisible({ timeout: 15_000 });
    });
}

async function runDragRangeCommentScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    test.setTimeout(90_000);
    const gapFile = testPullRequest.files.find(
        (file) => file.filename === GAP_FIXTURE_PATH,
    );
    if (!gapFile) throw new Error("Test PR has no gap fixture file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${gapFile.filename.replace(/\//g, "-")}"]`,
    );
    const commentText = `Split range comment ${Date.now()}`;

    await test.step("Drag from the inserted line down to the next context line", async () => {
        // The insertion lands on new line 3; the following context
        // line is new 4 / old 3.
        const plusRow = fileDiff.locator('tbody tr[data-new-line="3"]');
        await expect(plusRow).toBeVisible();
        const targetRow = fileDiff.locator('tbody tr[data-new-line="4"]');
        await expect(targetRow).toBeVisible();

        // Dispatch the drag through the app's real event handlers. Synthetic
        // mouse-drag choreography (boundingBox + mouse.move) is flaky under
        // parallel load because layout shifts mid-drag swallow the events;
        // the click-based tests already cover the real-mouse path to the
        // plus, so this exercises the drag logic deterministically. The
        // mouseup must arrive after React commits the extended range, or the
        // document mouseup listener still sees the single-line range.
        const dragged = await fileDiff.locator("tbody").evaluate(
            (tbody, { plusId, targetId }) => {
                const findRow = (id: string) =>
                    tbody.querySelector(`tr[data-new-line="${id}"]`);
                const plusRow = findRow(plusId);
                const target = findRow(targetId);
                const plus = plusRow?.querySelector(
                    "td.d2h-split-ln.d2h-split-new svg",
                );
                if (!plus || !target) return false;
                plus.dispatchEvent(
                    new MouseEvent("mousedown", {
                        bubbles: true,
                        cancelable: true,
                    }),
                );
                target.dispatchEvent(
                    new MouseEvent("mouseover", {
                        bubbles: true,
                        cancelable: true,
                    }),
                );
                return true;
            },
            { plusId: "3", targetId: "4" },
        );
        expect(dragged).toBe(true);
        // Wait until React commits the extended range before releasing.
        await expect(
            fileDiff.locator('tbody tr[data-new-line="4"] td.border-l-4'),
        ).toBeVisible({ timeout: 10_000 });
        await page.evaluate(() => {
            document.dispatchEvent(
                new MouseEvent("mouseup", {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        await expect(fileDiff.getByPlaceholder("Add a comment...")).toBeVisible(
            { timeout: 15_000 },
        );
    });

    await test.step("Submit the range comment", async () => {
        await fileDiff.getByPlaceholder("Add a comment...").fill(commentText);
        await fileDiff
            .getByRole("button", { name: "Add single comment" })
            .click();
    });

    await test.step("Verify the range comment thread appears", async () => {
        const thread = fileDiff
            .locator('[id^="review-thread-"]')
            .filter({ hasText: commentText });
        await expect(thread).toBeVisible({ timeout: 15_000 });
    });
}

async function runGapExpansionScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    const gapFile = testPullRequest.files.find(
        (file) => file.filename === GAP_FIXTURE_PATH,
    );
    if (!gapFile) throw new Error("Test PR has no gap fixture file");

    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);

    const fileDiff = page.locator(
        `[id="${gapFile.filename.replace(/\//g, "-")}"]`,
    );

    await test.step("Verify the unfold row between hunks spans the content columns", async () => {
        const unfoldRow = fileDiff.locator(
            "tbody tr:has(button[title='Expand lines above'])",
        );
        await expect(unfoldRow).toBeVisible();
        await expect(unfoldRow.locator('td[colspan="3"]')).toBeVisible();
    });

    await test.step("Expand the lines above the next hunk", async () => {
        await fileDiff
            .locator('tbody button[title="Expand lines above"]')
            .click();
    });

    await test.step("Verify the revealed gap rows use the old-file numbers", async () => {
        // Hunk 1 covers new lines 1-6, so the gap starts at new 7; the
        // insertion at new line 3 shifts the old numbering by -1, making the
        // first gap line old 6.
        const firstGapRow = fileDiff.locator('tbody tr[data-new-line="7"]');
        await expect(firstGapRow).toBeVisible({ timeout: 15_000 });
        await expect(firstGapRow).toHaveAttribute("data-old-line", "6");
        await expect(firstGapRow.locator("td")).toHaveCount(4);
        await expect(
            firstGapRow.locator(
                "td.d2h-split-ln:not(.d2h-split-new) .d2h-split-ln-num",
            ),
        ).toHaveText("6");
        await expect(
            firstGapRow.locator(
                "td.d2h-split-ln.d2h-split-new .d2h-split-ln-num",
            ),
        ).toHaveText("7");
        // The last revealed line of the 20-line expansion keeps the
        // same offset.
        const lastGapRow = fileDiff.locator('tbody tr[data-new-line="26"]');
        await expect(lastGapRow).toHaveAttribute("data-old-line", "25");
    });
}

async function runPreferencePersistenceScenario(
    page: Page,
    testPullRequest: TestChangesPullRequest,
) {
    await gotoChanges(page, testPullRequest.number);
    await setSplitView(page);
    await expect(page.locator("table.d2h-split-table").first()).toBeVisible();

    await page.reload();

    await test.step("Verify the split view is restored", async () => {
        await expect(page.locator("table.d2h-split-table").first()).toBeVisible(
            { timeout: 15_000 },
        );
        await expect(async () => {
            await page.getByRole("button", { name: "Diff settings" }).click();
            await expect(
                page.getByRole("menuitemradio", {
                    name: "Split",
                    exact: true,
                }),
            ).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
        }).toPass({ timeout: 15_000 });
    });
}
