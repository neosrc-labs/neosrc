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

/**
 * A file with two hunks separated by a gap, used to exercise split-view
 * context expansion. Base content is 40 lines ("Line 1".."Line 40"); the
 * branch copy inserts a line after "Line 2" (hunk `@@ -1,3 +1,4 @@`) and
 * replaces "Line 35" (hunk `@@ -34,3 +35,3 @@`). The gap spans new lines
 * 5-34, whose old numbers trail by one (the insertion shifts them by -1).
 */
export const GAP_FIXTURE_PATH = "e2e-gap-fixture.md";

function gapFixtureOldLines(): string[] {
    return Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`);
}

/**
 * Seed the gap fixture on the base branch with its canonical content
 * (idempotent; concurrent runs may create it first) and return its sha so
 * the test branch can modify it.
 */
async function ensureGapFixtureContent(
    octokit: Octokit,
    branch: string,
): Promise<string> {
    const canonical = gapFixtureOldLines().join("\n");
    let sha: string | undefined;
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: GAP_FIXTURE_PATH,
            ref: branch,
        });
        if (!Array.isArray(data) && data.type === "file" && data.content) {
            sha = data.sha;
            if (
                Buffer.from(data.content, "base64")
                    .toString("utf8")
                    .trimEnd() === canonical
            ) {
                return sha;
            }
        }
    } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
    }

    try {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: GAP_FIXTURE_PATH,
            message: "e2e gap fixture seed",
            content: Buffer.from(`${canonical}\n`).toString("base64"),
            branch,
            ...(sha ? { sha } : {}),
        });
    } catch (error) {
        // A concurrent run may have seeded the file between our read and
        // this write; fall through and read its sha.
        if ((error as { status?: number }).status !== 422) throw error;
    }

    const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: GAP_FIXTURE_PATH,
        ref: branch,
    });
    if (Array.isArray(data) || data.type !== "file") {
        throw new Error("Could not read the gap fixture file");
    }
    return data.sha;
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

    const [{ data: rootContents }] = await Promise.all([
        octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: "",
            ref: baseBranch,
        }),
    ]);
    const rootFiles = Array.isArray(rootContents)
        ? rootContents.filter((entry) => entry.type === "file")
        : [];

    // Seeding may advance the base HEAD, so the branch ref is fetched after.
    const gapFixtureSha = await ensureGapFixtureContent(octokit, baseBranch);

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

    const existingFile =
        rootFiles.find(
            (entry) =>
                entry.name.toLowerCase() === "readme.md" &&
                entry.path !== GAP_FIXTURE_PATH,
        ) ??
        rootFiles.find((entry) => entry.path !== GAP_FIXTURE_PATH) ??
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

    // Two hunks in one file: an insertion at new line 3 and a replacement at
    // new line 36, leaving a collapsed gap (new 5-34 / old 4-33) to expand.
    const gapNewLines = gapFixtureOldLines();
    gapNewLines.splice(2, 0, "INSERTED line");
    gapNewLines[35] = "Line 35 MODIFIED";
    await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: GAP_FIXTURE_PATH,
        message: commitMessage,
        content: Buffer.from(gapNewLines.join("\n")).toString("base64"),
        branch: branchName,
        sha: gapFixtureSha,
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
