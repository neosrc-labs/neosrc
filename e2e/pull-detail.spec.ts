import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";

const TEST_REPO = process.env.E2E_TEST_REPO ?? "neosrc-labs/test-repo";
const [OWNER, REPO] = TEST_REPO.split("/") as [string, string];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

test.describe
    .serial("Pull request detail", { tag: ["@github"] }, () => {
        let prNumber: number;
        let prTitle: string;
        let authorLogin: string;
        let commitMessage: string;

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

        test("shows the first commit message in the sidebar and timeline", async ({
            page,
        }) => {
            await page.goto(`/gh/${OWNER}/${REPO}/pull/${prNumber}`);

            await expect(
                page.locator("main").getByText(commitMessage),
            ).toBeVisible();

            await page.getByRole("button", { name: /Commits/ }).click();

            await expect(
                page.locator("aside").getByText(commitMessage),
            ).toBeVisible();
        });

        test("shows state, title, author, description, and labels", async ({
            page,
        }) => {
            await page.goto(`/gh/${OWNER}/${REPO}/pull/${prNumber}`);

            await expect(page.getByText("Open", { exact: true })).toBeVisible();

            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                prTitle,
            );

            await expect(page.getByText("opened by")).toBeVisible();
            await expect(
                page.locator("main").getByText(authorLogin),
            ).toBeVisible();

            await expect(
                page.locator("h3").filter({ hasText: "Description" }),
            ).toBeVisible();
            await expect(page.getByText("Created by e2e test.")).toBeVisible();

            await expect(
                page.locator("aside h3").filter({ hasText: "Labels" }),
            ).toBeVisible();
            await expect(page.locator("aside").getByText("e2e")).toBeVisible();
        });
    });
