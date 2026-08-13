import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";
import {
    collapseLeftSidebar,
    collapseRightSidebar,
    expandLeftSidebar,
    expandRightSidebar,
    GITHUB_TOKEN,
    OWNER,
    REPO,
} from "./shared/helpers";
import { navigateToPr } from "./shared/steps";

test.describe
    .serial("Pull request detail", { tag: ["@github"] }, () => {
        let prNumber: number;
        let prTitle: string;
        let authorLogin: string;
        let commitMessage: string;
        let baseBranch: string;
        let headBranch: string;

        test.beforeAll(async () => {
            test.skip(
                !GITHUB_TOKEN,
                "GITHUB_TOKEN not set — skipping API-based test",
            );

            const octokit = new Octokit({ auth: GITHUB_TOKEN });

            const { data: repo } = await octokit.rest.repos.get({
                owner: OWNER,
                repo: REPO,
            });

            const { data: user } = await octokit.rest.users.getAuthenticated();
            authorLogin = user.login;

            const branchName = `e2e-test-${Date.now()}`;
            headBranch = branchName;
            baseBranch = repo.default_branch;
            const filePath = `e2e-${Date.now()}.md`;
            commitMessage = "e2e test commit";

            const { data: baseRef } = await octokit.rest.git.getRef({
                owner: OWNER,
                repo: REPO,
                ref: `heads/${repo.default_branch}`,
            });

            await octokit.rest.git.createRef({
                owner: OWNER,
                repo: REPO,
                ref: `refs/heads/${branchName}`,
                sha: baseRef.object.sha,
            });

            await octokit.rest.repos.createOrUpdateFileContents({
                owner: OWNER,
                repo: REPO,
                path: filePath,
                message: commitMessage,
                content: Buffer.from("# E2E Test\n").toString("base64"),
                branch: branchName,
            });

            prTitle = `E2E Test PR ${Date.now()}`;
            const { data: pr } = await octokit.rest.pulls.create({
                owner: OWNER,
                repo: REPO,
                title: prTitle,
                head: branchName,
                base: repo.default_branch,
                body: "Created by e2e test.",
            });
            prNumber = pr.number;

            try {
                await octokit.rest.issues.createLabel({
                    owner: OWNER,
                    repo: REPO,
                    name: "e2e",
                    color: "FF0000",
                    description: "E2E test label",
                });
            } catch {
                // Label may already exist from a previous run
            }

            await octokit.rest.issues.addLabels({
                owner: OWNER,
                repo: REPO,
                issue_number: prNumber,
                labels: ["e2e"],
            });
        });

        test.afterAll(async () => {
            if (!GITHUB_TOKEN || !prNumber) return;

            const octokit = new Octokit({ auth: GITHUB_TOKEN });
            try {
                await octokit.rest.pulls.update({
                    owner: OWNER,
                    repo: REPO,
                    pull_number: prNumber,
                    state: "closed",
                });
            } catch {
                // Best-effort cleanup
            }
        });

        test("should render basic PR details correctly", async ({ page }) => {
            await navigateToPr(page, prNumber);

            await test.step("Verify the PR state badge is visible", async () => {
                await expect(
                    page.getByText("Open", { exact: true }),
                ).toBeVisible();
            });

            await test.step("Verify the PR title is correct", async () => {
                await expect(
                    page.getByRole("heading", { level: 1 }),
                ).toHaveText(prTitle);
            });

            await test.step("Verify the PR number is visible", async () => {
                await expect(
                    page.getByText(`#${prNumber}`, { exact: true }),
                ).toBeVisible();
            });

            await test.step("Verify the base branch is visible", async () => {
                await expect(
                    page.getByTestId("pr-description").getByText(baseBranch),
                ).toBeVisible();
            });

            await test.step("Verify the head branch is visible", async () => {
                // On small screens we truncate the head branch to save space
                const headBranchPrefix = headBranch.substring(0, 10);
                await expect(
                    page
                        .getByTestId("pr-description")
                        .getByText(headBranchPrefix),
                ).toBeVisible();
            });

            await test.step("Verify the author is displayed", async () => {
                await expect(
                    page.getByTestId("pr-description").getByText(authorLogin),
                ).toBeVisible();
            });

            await test.step("Verify the description section and body text", async () => {
                await expect(
                    page.locator("h3").filter({ hasText: "Description" }),
                ).toBeVisible();
                await expect(
                    page.getByText("Created by e2e test."),
                ).toBeVisible();
            });

            await test.step("Verify labels are shown in the sidebar", async () => {
                await expect(
                    page
                        .getByTestId("right-sidebar")
                        .getByRole("heading")
                        .filter({ hasText: "Labels" }),
                ).toBeVisible();
                await expect(
                    page.getByTestId("right-sidebar").getByText("e2e"),
                ).toBeVisible();
            });

            await test.step("Verify files changed count in the left sidebar", async () => {
                await expect(
                    page.getByTestId("left-sidebar").getByText("Files Changed"),
                ).toBeVisible();
            });

            await test.step("Verify the commit message appears in the timeline", async () => {
                await expect(
                    page.getByTestId("timeline").getByText(commitMessage),
                ).toBeVisible();
            });

            await test.step("Switch to the commits tab in the sidebar", async () => {
                await page.getByRole("button", { name: /Commits/ }).click();
            });

            await test.step("Verify the commit message appears in the sidebar commits list", async () => {
                await expect(
                    page.getByTestId("right-sidebar").getByText(commitMessage),
                ).toBeVisible();
            });
        });

        test("should allow ability to comment", async ({ page }) => {
            const commentText = `E2E test comment ${Date.now()}`;
            const editedCommentText = `${commentText} edited`;

            await navigateToPr(page, prNumber);

            await test.step("Verify ability to comment from the timeline", async () => {
                await test.step("Type a comment in the comment form", async () => {
                    const textarea = page.getByPlaceholder("Leave a comment");
                    await textarea.scrollIntoViewIfNeeded();
                    await textarea.fill(commentText);
                });

                await test.step("Submit the comment", async () => {
                    const commentButton = page
                        .getByTestId("timeline")
                        .getByRole("button", { name: "Comment" });
                    await expect(commentButton).toBeEnabled();
                    await commentButton.click();
                });

                await test.step("Verify the comment appears in the timeline", async () => {
                    await expect(
                        page.getByTestId("timeline").getByText(commentText),
                    ).toBeVisible();

                    // Wait for optimistic insert to settle ("Saving..." disappears).
                    // The comment write hits the GitHub API, which can exceed
                    // the default 5s assertion timeout on a cold call.
                    await expect(
                        page.getByTestId("timeline").getByText("Saving..."),
                    ).not.toBeAttached({ timeout: 15_000 });
                });
            });

            await test.step("Verify ability to edit a comment", async () => {
                const commentCard = page
                    .getByTestId("timeline")
                    .locator('[id^="issuecomment-"]')
                    .filter({ hasText: commentText });

                await test.step("Open the comment menu and choose Edit", async () => {
                    await commentCard
                        .getByRole("button", { name: "More options" })
                        .click();

                    const editButton = page
                        .locator("[data-radix-popper-content-wrapper]")
                        .getByRole("button", { name: "Edit" });
                    await expect(editButton).toBeVisible();
                    await editButton.click();
                });

                await test.step("Replace the comment body", async () => {
                    const editor = commentCard.locator("textarea");
                    await expect(editor).toBeVisible();
                    await editor.fill(editedCommentText);
                });

                await test.step("Save the edit", async () => {
                    await commentCard
                        .getByRole("button", { name: "Save" })
                        .click();
                });

                await test.step("Verify the edited comment appears in the timeline", async () => {
                    await expect(
                        page
                            .getByTestId("timeline")
                            .getByText(editedCommentText),
                    ).toBeVisible();
                });
            });

            await test.step("Verify ability to add and remove reactions", async () => {
                const commentCard = page
                    .getByTestId("timeline")
                    .locator('[id^="issuecomment-"]')
                    .filter({ hasText: commentText });

                await test.step("Add a reaction", async () => {
                    await commentCard
                        .locator('button[aria-label="Add reaction"]')
                        .click();

                    await page
                        .locator("[data-radix-popper-content-wrapper]")
                        .locator('button[aria-label="+1"]')
                        .click();

                    await expect(
                        commentCard.locator('button[aria-label="👍 (1)"]'),
                    ).toBeVisible();
                });

                await test.step("Remove the reaction", async () => {
                    await commentCard
                        .locator('button[aria-label="👍 (1)"]')
                        .click();

                    await expect(
                        commentCard.locator('button[aria-label="👍 (1)"]'),
                    ).not.toBeVisible();
                });
            });

            await test.step("Verify ability to delete a comment", async () => {
                const commentCard = page
                    .getByTestId("timeline")
                    .locator('[id^="issuecomment-"]')
                    .filter({ hasText: commentText });

                await test.step("Open the comment menu and choose Delete comment", async () => {
                    await commentCard
                        .getByRole("button", { name: "More options" })
                        .click();

                    const deleteMenuItem = page
                        .locator("[data-radix-popper-content-wrapper]")
                        .getByRole("button", { name: "Delete comment" });
                    await expect(deleteMenuItem).toBeVisible();
                    await deleteMenuItem.click();
                });

                await test.step("Confirm deletion in the dialog", async () => {
                    const dialog = page.getByRole("dialog");
                    await expect(dialog).toBeVisible();
                    await dialog
                        .getByRole("button", { name: "Delete" })
                        .click();
                });

                await test.step("Verify the comment is removed from the timeline", async () => {
                    await expect(
                        page.getByTestId("timeline").getByText(commentText),
                    ).not.toBeVisible();
                });
            });
        });

        test("should collapse and expand sidebars", async ({ page }) => {
            await navigateToPr(page, prNumber);

            await test.step("Verify both sidebars start visible", async () => {
                await expect(page.getByTestId("left-sidebar")).toBeVisible();
                await expect(page.getByTestId("right-sidebar")).toBeVisible();
            });

            await test.step("Collapse the right sidebar", async () => {
                await collapseRightSidebar(page);
            });

            await test.step("Verify the right sidebar is collapsed", async () => {
                await expect(
                    page.getByTestId("right-sidebar"),
                ).not.toBeAttached();
            });

            await test.step("Expand the right sidebar", async () => {
                await expandRightSidebar(page);
            });

            await test.step("Verify the right sidebar is expanded again", async () => {
                await expect(page.getByTestId("right-sidebar")).toBeVisible();
            });

            await test.step("Collapse the left sidebar", async () => {
                await collapseLeftSidebar(page);
            });

            await test.step("Verify the left sidebar is collapsed", async () => {
                await expect(
                    page.getByTestId("left-sidebar"),
                ).not.toBeAttached();
            });

            await test.step("Expand the left sidebar", async () => {
                await expandLeftSidebar(page);
            });

            await test.step("Verify the left sidebar is expanded again", async () => {
                await expect(page.getByTestId("left-sidebar")).toBeVisible();
            });
        });
    });
