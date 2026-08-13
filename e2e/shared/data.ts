import { Octokit } from "@octokit/rest";
import { GITHUB_TOKEN, OWNER, REPO } from "./helpers";

export interface TestPullRequest {
    number: number;
    title: string;
    authorLogin: string;
    commitMessage: string;
    baseBranch: string;
    headBranch: string;
}

export async function createTestPullRequest(): Promise<TestPullRequest> {
    if (!GITHUB_TOKEN) {
        throw new Error(
            "GITHUB_TOKEN is required to create a test pull request",
        );
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const { data: repo } = await octokit.rest.repos.get({
        owner: OWNER,
        repo: REPO,
    });

    const { data: user } = await octokit.rest.users.getAuthenticated();
    const branchName = `e2e-test-${Date.now()}`;
    const baseBranch = repo.default_branch;
    const filePath = `e2e-${Date.now()}.md`;
    const commitMessage = "e2e test commit";

    const { data: baseRef } = await octokit.rest.git.getRef({
        owner: OWNER,
        repo: REPO,
        ref: `heads/${baseBranch}`,
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

    const title = `E2E Test PR ${Date.now()}`;
    const { data: pullRequest } = await octokit.rest.pulls.create({
        owner: OWNER,
        repo: REPO,
        title,
        head: branchName,
        base: baseBranch,
        body: "Created by e2e test.",
    });

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
        issue_number: pullRequest.number,
        labels: ["e2e"],
    });

    return {
        number: pullRequest.number,
        title,
        authorLogin: user.login,
        commitMessage,
        baseBranch,
        headBranch: branchName,
    };
}
