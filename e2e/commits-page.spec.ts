import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";
import { GITHUB_TOKEN, OWNER, REPO } from "./shared/helpers";

interface ExpectedCommit {
    sha: string;
    shortSha: string;
    subject: string;
    authorLogin: string | null;
}

test.describe
    .serial("Commits list page", { tag: ["@github"] }, () => {
        let branch: string;
        let expectedCommits: ExpectedCommit[];

        test.beforeAll(async () => {
            test.skip(
                !GITHUB_TOKEN,
                "GITHUB_TOKEN not set - skipping API-based test",
            );

            const octokit = new Octokit({ auth: GITHUB_TOKEN });

            const { data: repo } = await octokit.rest.repos.get({
                owner: OWNER,
                repo: REPO,
            });
            branch = repo.default_branch;

            const { data: commits } = await octokit.rest.repos.listCommits({
                owner: OWNER,
                repo: REPO,
                sha: branch,
                per_page: 35,
            });

            test.skip(
                commits.length === 0,
                "No commits on the default branch - skipping",
            );

            expectedCommits = commits
                .map((c) => {
                    const [subject = ""] = c.commit.message.split("\n");
                    return {
                        sha: c.sha,
                        shortSha: c.sha.slice(0, 7),
                        subject,
                        authorLogin: c.author?.login ?? null,
                    };
                })
                .filter((c) => c.subject.length > 0);
        });

        test("should render commits fetched from the GitHub API", async ({
            page,
        }) => {
            await test.step("Navigate to the commits page", async () => {
                await page.goto(`/gh/${OWNER}/${REPO}/commits/${branch}`);
                const firstCommit = expectedCommits[0];
                if (!firstCommit) return;
                // The commit list is fetched client-side (tRPC) after
                // hydration, so networkidle does not mean the data is ready.
                // Wait for the first commit row instead.
                await expect(
                    page.getByText(firstCommit.shortSha, {
                        exact: true,
                    }),
                ).toBeVisible({ timeout: 30_000 });
            });

            await test.step("Verify the page title", async () => {
                await expect(page).toHaveTitle(
                    `Commits - ${OWNER}/${REPO}/${branch}`,
                );
            });

            await test.step("Verify the first three commits are displayed", async () => {
                for (const commit of expectedCommits.slice(0, 3)) {
                    await expect(
                        page.getByText(commit.shortSha, { exact: true }),
                    ).toBeVisible();
                    await expect(
                        page.getByText(commit.subject).first(),
                    ).toBeVisible();
                }
            });

            await test.step("Verify the commit author is displayed", async () => {
                const withAuthor = expectedCommits.find((c) => c.authorLogin);
                if (withAuthor?.authorLogin) {
                    await expect(
                        page.getByText(withAuthor.authorLogin).first(),
                    ).toBeVisible();
                }
            });
        });
    });
