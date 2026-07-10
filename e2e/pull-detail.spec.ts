import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";

const TEST_REPO = process.env.E2E_TEST_REPO ?? "neosrc-labs/test-repo";
const [OWNER, REPO] = TEST_REPO.split("/") as [string, string];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

test.describe
    .serial("Pull request detail", () => {
        let prNumber: number;
        let prTitle: string;

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

            const branchName = `e2e-test-${Date.now()}`;
            const filePath = `e2e-${Date.now()}.md`;

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
                message: "e2e test commit",
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
                // Best-effort cleanup — branch may be auto-deleted by repo settings
            }
        });

        test("loads the pull request page with the correct title", async ({
            page,
        }) => {
            await page.goto(`/gh/${OWNER}/${REPO}/pull/${prNumber}`);

            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                prTitle,
            );
        });
    });
