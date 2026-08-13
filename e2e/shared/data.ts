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

    const [{ data: repo }, { data: user }] = await Promise.all([
        octokit.rest.repos.get({
            owner: OWNER,
            repo: REPO,
        }),
        octokit.rest.users.getAuthenticated(),
    ]);
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

    await ensureE2eLabel(octokit);

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

export interface TestPullRequestFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
}

export interface TestChangesPullRequest extends TestPullRequest {
    additions: number;
    deletions: number;
    changedFiles: number;
    files: TestPullRequestFile[];
}

export async function createTestChangesPullRequest(): Promise<TestChangesPullRequest> {
    if (!GITHUB_TOKEN) {
        throw new Error(
            "GITHUB_TOKEN is required to create a test pull request",
        );
    }
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const [{ data: repo }, { data: user }] = await Promise.all([
        octokit.rest.repos.get({
            owner: OWNER,
            repo: REPO,
        }),
        octokit.rest.users.getAuthenticated(),
    ]);

    const timestamp = Date.now();
    const branchName = `e2e-changes-${timestamp}`;
    const baseBranch = repo.default_branch;
    const newFilePath = `e2e-changes-added-${timestamp}.md`;
    const commitMessage = "e2e changes test commit";

    const [{ data: rootContents }, { data: baseRef }] = await Promise.all([
        octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: "",
            ref: baseBranch,
        }),
        octokit.rest.git.getRef({
            owner: OWNER,
            repo: REPO,
            ref: `heads/${baseBranch}`,
        }),
    ]);
    const rootFiles = Array.isArray(rootContents)
        ? rootContents.filter((entry) => entry.type === "file")
        : [];
    const existingFile =
        rootFiles.find((entry) => entry.name.toLowerCase() === "readme.md") ??
        rootFiles[0];

    if (existingFile?.type !== "file") {
        throw new Error(
            "Could not find a file to modify in the test repository",
        );
    }

    const [{ data: existingContent }] = await Promise.all([
        octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: existingFile.path,
            ref: baseBranch,
        }),
        octokit.rest.git.createRef({
            owner: OWNER,
            repo: REPO,
            ref: `refs/heads/${branchName}`,
            sha: baseRef.object.sha,
        }),
    ]);

    if (
        Array.isArray(existingContent) ||
        existingContent.type !== "file" ||
        !existingContent.content
    ) {
        throw new Error(
            "Could not read the file to modify in the test repository",
        );
    }

    const lines = Buffer.from(existingContent.content, "base64")
        .toString("utf8")
        .split("\n");
    const lineToReplace = lines.findIndex((line) => line.length > 0);
    if (lineToReplace === -1) {
        throw new Error("The file to modify is empty");
    }
    lines[lineToReplace] = `E2E test modification ${timestamp}`;

    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: newFilePath,
        message: commitMessage,
        content: Buffer.from("# E2E Changes Test\n").toString("base64"),
        branch: branchName,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: existingFile.path,
        message: commitMessage,
        content: Buffer.from(lines.join("\n")).toString("base64"),
        branch: branchName,
        sha: existingFile.sha,
    });

    const title = `E2E Changes PR ${timestamp}`;
    const { data: createdPullRequest } = await octokit.rest.pulls.create({
        owner: OWNER,
        repo: REPO,
        title,
        head: branchName,
        base: baseBranch,
        body: "Created by e2e changes test.",
    });

    await ensureE2eLabel(octokit);

    await octokit.rest.issues.addLabels({
        owner: OWNER,
        repo: REPO,
        issue_number: createdPullRequest.number,
        labels: ["e2e"],
    });
    const [{ data: pullRequest }, { data: files }] = await Promise.all([
        octokit.rest.pulls.get({
            owner: OWNER,
            repo: REPO,
            pull_number: createdPullRequest.number,
        }),
        octokit.rest.pulls.listFiles({
            owner: OWNER,
            repo: REPO,
            pull_number: createdPullRequest.number,
            per_page: 100,
        }),
    ]);

    return {
        number: pullRequest.number,
        title,
        authorLogin: user.login,
        commitMessage,
        baseBranch,
        headBranch: branchName,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
        changedFiles: pullRequest.changed_files,
        files: files.map((file) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
        })),
    };
}

let e2eLabelPromise: Promise<void> | undefined;

async function ensureE2eLabel(octokit: Octokit) {
    e2eLabelPromise ??= (async () => {
        try {
            await octokit.rest.issues.getLabel({
                owner: OWNER,
                repo: REPO,
                name: "e2e",
            });
        } catch (error) {
            if ((error as { status?: number }).status !== 404) throw error;
            await octokit.rest.issues.createLabel({
                owner: OWNER,
                repo: REPO,
                name: "e2e",
                color: "FF0000",
                description: "E2E test label",
            });
        }
    })();

    await e2eLabelPromise;
}
