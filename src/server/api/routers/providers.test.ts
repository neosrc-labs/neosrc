import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub everything the routers pull in at import time so the callers run
// against fakes instead of env vars, postgres, or the GitHub/Codeberg APIs.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({
    env: { GITHUB_ANONYMOUS_TOKEN: "shared-anonymous-token" },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
    getGitHubToken: vi.fn(),
    getCodebergToken: vi.fn(),
}));
vi.mock("~/server/cache", () => ({
    prCacheKey: (owner: string, repo: string, number: number) =>
        `pr:${owner}:${repo}:${number}`,
    repoStarredCacheKey: (
        provider: string,
        userId: string,
        owner: string,
        repo: string,
    ) => `${provider}:starred:${userId}:${owner}:${repo}`,
    repoSubscriptionCacheKey: (
        provider: string,
        userId: string,
        owner: string,
        repo: string,
    ) => `${provider}:subscription:${userId}:${owner}:${repo}`,
    deleteCache: vi.fn(),
    readCache: vi.fn(),
}));
vi.mock("~/server/repo-cache", () => {
    class RepoNotFoundError extends Error {}
    return {
        RepoNotFoundError,
        getRepoPermissionForUser: vi.fn(),
        viewerRepoAccess: vi.fn(),
    };
});
vi.mock("~/server/github-graphql", () => ({
    getTopRepositories: vi.fn(),
    getPullRequestHeadShaGraphQL: vi.fn(),
}));

function fns<T extends string[]>(...names: T) {
    return Object.fromEntries(names.map((n) => [n, vi.fn()]));
}

vi.mock("~/server/github", () => ({
    DOC_FILE_PATTERNS: [],
    ...fns(
        "deleteRepoSubscription",
        "getCachedDocFileContent",
        "getCachedRepo",
        "getCachedRepoContributors",
        "getCachedRepoDocFileNames",
        "getCachedRepoIssuePullCounts",
        "getCachedRepoLanguages",
        "getCachedRepoStarred",
        "getCachedRepoSubscription",
        "getDocFileDisplayName",
        "getDocFileSortKey",
        "getFileLatestCommits",
        "getForkComparison",
        "getUserRepos",
        "getLatestRelease",
        "getRepoBranches",
        "getRepoContents",
        "getRepoDeployments",
        "getRepoDocFiles",
        "getRepoFileTree",
        "getRepoLatestCommit",
        "getRepoRefCounts",
        "getRepoTags",
        "mergeForkUpstream",
        "setRepoSubscription",
        "starRepo",
        "unstarRepo",
        "addAssigneesToIssue",
        "addLabelsToIssue",
        "addReviewersToPullRequest",
        "createIssueComment",
        "createPullRequestReview",
        "createPullRequestStack",
        "deleteBranchRef",
        "deleteIssueComment",
        "getCachedPullRequest",
        "getMergeAsyncResult",
        "getMergeRequirements",
        "getPullRequest",
        "getPullRequestReviews",
        "getPullRequestStack",
        "listLabelsForRepo",
        "listMilestonesForRepo",
        "listPullRequests",
        "listRecentIssueAuthors",
        "listRepoAssignees",
        "markPullRequestAsDraft",
        "markPullRequestAsReady",
        "mergePullRequest",
        "mergePullRequestAsync",
        "removeAssigneesFromIssue",
        "removeLabelFromIssue",
        "removeReviewersFromPullRequest",
        "revertPullRequest",
        "unstackPullRequests",
        "updateIssueComment",
        "updateIssueMilestone",
        "updatePullRequest",
        "updatePullRequestReview",
    ),
}));

vi.mock("~/server/codeberg", () => ({
    ...fns(
        "deleteRepoSubscription",
        "getCachedRepo",
        "getCachedRepoCounts",
        "getCachedRepoStarred",
        "getCachedRepoSubscription",
        "getBranches",
        "getFileContent",
        "getFileLatestCommit",
        "getFileTree",
        "getLatestCommit",
        "getLatestRelease",
        "getRefCounts",
        "getRepoContents",
        "getRepoLanguages",
        "getTags",
        "getUserRepos",
        "setRepoSubscription",
        "starRepo",
        "unstarRepo",
        "listAssignees",
        "listLabels",
        "listMilestones",
        "listRecentIssueAuthors",
    ),
}));

vi.mock("~/server/api/routers/checks", () => ({
    PR_STATUS_BATCH_SIZE: 50,
    buildPrStatusBatchQuery: vi.fn(),
    extractMergeStateStatus: vi.fn(),
    extractStatusContexts: vi.fn(),
}));
vi.mock("@octokit/graphql", () => ({ graphql: vi.fn() }));

import { pullsRouter } from "~/server/api/routers/pulls";
import { reposRouter } from "~/server/api/routers/repos";
import { createCallerFactory, createTRPCContext } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken, getSession } from "~/server/auth";
import * as cache from "~/server/cache";
import * as codeberg from "~/server/codeberg";
import * as github from "~/server/github";

const getSessionMock = vi.mocked(getSession);
const getGitHubTokenMock = vi.mocked(getGitHubToken);
const getCodebergTokenMock = vi.mocked(getCodebergToken);
const deleteCacheMock = vi.mocked(cache.deleteCache);

async function callerFor(session: unknown) {
    getSessionMock.mockResolvedValue(session as never);
    const ctx = await createTRPCContext({ headers: new Headers() });
    return {
        repos: createCallerFactory(reposRouter)(ctx),
        pulls: createCallerFactory(pullsRouter)(ctx),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getGitHubTokenMock.mockResolvedValue("gh-token");
    getCodebergTokenMock.mockResolvedValue("cb-token");
});

describe("provider-aware procedures (repos router)", () => {
    it("read dispatches to the GitHub handler with the session token", async () => {
        const { repos } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.getRepoBranches).mockResolvedValue(["main"] as never);

        await expect(
            repos.getBranches({ owner: "acme", repo: "api" }),
        ).resolves.toEqual(["main"]);

        expect(getGitHubTokenMock).toHaveBeenCalledWith({}, "user-1");
        expect(github.getRepoBranches).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
        );
        expect(getCodebergTokenMock).not.toHaveBeenCalled();
    });

    it("read dispatches to the Codeberg handler when provider is cb", async () => {
        const { repos } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(codeberg.getBranches).mockResolvedValue(["main"] as never);

        await expect(
            repos.getBranches({
                provider: "cb",
                owner: "acme",
                repo: "api",
            }),
        ).resolves.toEqual(["main"]);

        expect(getCodebergTokenMock).toHaveBeenCalledWith({}, "user-1");
        expect(codeberg.getBranches).toHaveBeenCalledWith(
            "cb-token",
            "acme",
            "api",
        );
        expect(getGitHubTokenMock).not.toHaveBeenCalled();
    });

    it("anonymous reads resolve the user id to 'anonymous' before token lookup", async () => {
        const { repos } = await callerFor(null);
        vi.mocked(github.getCachedRepoIssuePullCounts).mockResolvedValue({
            issues: 0,
            pulls: 0,
        } as never);

        await expect(
            repos.getCountsByOwnerAndRepo({ owner: "acme", repo: "api" }),
        ).resolves.toEqual({ issues: 0, pulls: 0 });

        expect(getGitHubTokenMock).toHaveBeenCalledWith({}, "anonymous");
        expect(github.getCachedRepoIssuePullCounts).toHaveBeenCalledWith(
            "gh-token",
            "anonymous",
            "acme",
            "api",
        );
    });

    it("evicting mutation stars on GitHub and evicts the keyed cache entry", async () => {
        const { repos } = await callerFor({ user: { id: "user-1" } });

        await expect(
            repos.star({ owner: "acme", repo: "api" }),
        ).resolves.toBeUndefined();

        expect(github.starRepo).toHaveBeenCalledWith("gh-token", "acme", "api");
        expect(deleteCacheMock).toHaveBeenCalledWith(
            "gh:starred:user-1:acme:api",
        );
    });

    it("evicting mutation stars on Codeberg and evicts the cb-keyed cache entry", async () => {
        const { repos } = await callerFor({ user: { id: "user-1" } });

        await expect(
            repos.star({ provider: "cb", owner: "acme", repo: "api" }),
        ).resolves.toBeUndefined();

        expect(codeberg.starRepo).toHaveBeenCalledWith(
            "cb-token",
            "acme",
            "api",
        );
        expect(deleteCacheMock).toHaveBeenCalledWith(
            "cb:starred:user-1:acme:api",
        );
    });

    it("mutations reject anonymous visitors", async () => {
        const { repos } = await callerFor(null);

        await expect(
            repos.star({ owner: "acme", repo: "api" }),
        ).rejects.toBeInstanceOf(TRPCError);
        expect(github.starRepo).not.toHaveBeenCalled();
        expect(deleteCacheMock).not.toHaveBeenCalled();
    });
});

describe("github-only procedures (pulls router)", () => {
    it("non-evicting mutation updates a comment without touching the PR cache", async () => {
        const { pulls } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.updateIssueComment).mockResolvedValue({
            body: "edited",
        } as never);

        await expect(
            pulls.updateComment({
                owner: "acme",
                repo: "api",
                commentId: 7,
                body: "edited",
            }),
        ).resolves.toEqual({ success: true, body: "edited" });

        expect(github.updateIssueComment).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            7,
            "edited",
        );
        expect(deleteCacheMock).not.toHaveBeenCalled();
    });

    it("evicting mutation adds a label and evicts the PR cache entry", async () => {
        const { pulls } = await callerFor({ user: { id: "user-1" } });

        await pulls.addLabel({
            owner: "acme",
            repo: "api",
            number: 5,
            label: "bug",
        });

        expect(github.addLabelsToIssue).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            5,
            ["bug"],
        );
        expect(deleteCacheMock).toHaveBeenCalledWith("pr:acme:api:5");
    });

    it("query fetches with the GitHub token and returns the handler result", async () => {
        const { pulls } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.listPullRequests).mockResolvedValue([] as never);

        await expect(
            pulls.list({ owner: "acme", repo: "api" }),
        ).resolves.toEqual([]);

        expect(getGitHubTokenMock).toHaveBeenCalledWith({}, "user-1");
        expect(github.listPullRequests).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            "open",
            undefined,
        );
    });
});
