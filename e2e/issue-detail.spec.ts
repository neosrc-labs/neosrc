import { randomUUID } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { test as base, expect } from "@playwright/test";
import { GITHUB_TOKEN, OWNER, REPO } from "./shared/helpers";

interface TestIssue {
    number: number;
    title: string;
    authorLogin: string;
    commentId: number;
    commentAuthorLogin: string;
}

const test = base.extend<{ issue: TestIssue }>({
    issue: [
        // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
        async ({}, use) => {
            test.skip(
                !GITHUB_TOKEN,
                "GITHUB_TOKEN is required to seed an issue",
            );
            const octokit = new Octokit({
                auth: GITHUB_TOKEN,
                request: { timeout: 15_000 },
            });
            const headers = { "X-GitHub-Api-Version": "2026-03-10" };
            const title = `E2E issue rendering ${randomUUID()}`;
            const { data: issue } = await octokit.rest.issues.create({
                headers,
                owner: OWNER,
                repo: REPO,
                title,
                body: [
                    "## Rendering example",
                    "",
                    "The issue description contains **important details** and `example.ts`.",
                    "",
                    "- First reproduction step",
                    "- Second reproduction step",
                    "",
                    "[Reference documentation](https://example.com/issue-reference)",
                ].join("\n"),
            });
            let commentId: number | undefined;

            try {
                const { data: comment } =
                    await octokit.rest.issues.createComment({
                        headers,
                        owner: OWNER,
                        repo: REPO,
                        issue_number: issue.number,
                        body: "Confirmed the **rendering example** in the timeline.",
                    });
                commentId = comment.id;
                if (!issue.user || !comment.user) {
                    throw new Error(
                        "Seeded issue and comment must have authors",
                    );
                }
                await use({
                    number: issue.number,
                    title,
                    authorLogin: issue.user.login,
                    commentId,
                    commentAuthorLogin: comment.user.login,
                });
            } finally {
                try {
                    if (commentId !== undefined) {
                        await octokit.rest.issues.deleteComment({
                            headers,
                            owner: OWNER,
                            repo: REPO,
                            comment_id: commentId,
                        });
                    }
                } finally {
                    // GitHub REST cannot delete issues. Close only our fixture.
                    await octokit.rest.issues.update({
                        headers,
                        owner: OWNER,
                        repo: REPO,
                        issue_number: issue.number,
                        state: "closed",
                        state_reason: "not_planned",
                    });
                }
            }
        },
        { timeout: 60_000 },
    ],
});

test("renders issue details, Markdown, and timeline comments", {
    tag: ["@github"],
}, async ({ page, issue }) => {
    await page.goto(`/gh/${OWNER}/${REPO}/issues/${issue.number}`, {
        waitUntil: "domcontentloaded",
    });
    const description = page.getByTestId("issue-description");

    await test.step("Issue header", async () => {
        await expect(description.getByRole("heading", { level: 1 })).toHaveText(
            issue.title,
        );
        await expect(
            description.getByText(`#${issue.number}`, { exact: true }),
        ).toBeVisible();
        await expect(
            description.getByText("Open", { exact: true }),
        ).toBeVisible();
        await expect(
            description.getByText(issue.authorLogin, { exact: true }),
        ).toBeVisible();
    });

    await test.step("Rendered description", async () => {
        await expect(
            description.getByRole("heading", {
                name: "Rendering example",
                level: 2,
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            description.getByText(
                "The issue description contains important details and example.ts.",
                { exact: true },
            ),
        ).toBeVisible();
        await expect(description.locator("strong")).toHaveText(
            "important details",
        );
        await expect(description.locator("code")).toHaveText("example.ts");
        await expect(description.getByRole("listitem")).toHaveText([
            "First reproduction step",
            "Second reproduction step",
        ]);
        const reference = description.getByRole("link", {
            name: "Reference documentation",
            exact: true,
        });
        await expect(reference).toBeVisible();
        await expect(reference).toHaveAttribute(
            "href",
            "https://example.com/issue-reference",
        );
    });

    await test.step("Rendered timeline comment", async () => {
        const comment = page.locator(`#issuecomment-${issue.commentId}`);
        await expect(comment).toBeVisible();
        await expect(
            comment.getByText(issue.commentAuthorLogin, { exact: true }),
        ).toBeVisible();
        await expect(
            comment.getByText(
                "Confirmed the rendering example in the timeline.",
                { exact: true },
            ),
        ).toBeVisible();
        await expect(comment.locator("strong")).toHaveText("rendering example");
    });
});
