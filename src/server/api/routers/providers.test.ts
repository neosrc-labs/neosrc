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
    getPullRequestMergeStateGraphQL: vi.fn(),
}));

function fns<T extends string[]>(...names: T) {
    return Object.fromEntries(names.map((n) => [n, vi.fn()]));
}

vi.mock("~/server/github", () => ({
    // Constants the routers read off the module are not functions, so the
    // wholesale mock has to declare them.
    BRANCH_PAGE_SIZE: 30,
    REF_SCAN_PAGE_SIZE: 100,
    MAX_REF_SCAN_PAGES: 3,
    MAX_REF_WALK_PAGES: 20,
    ...fns(
        "deleteRepoSubscription",
        "getCachedFileContent",
        "getCachedRepo",
        "getCachedRepoContributors",
        "getCachedRepoDocFileNames",
        "getCachedRepoIssuePullCounts",
        "getCachedRepoLanguages",
        "getCachedRepoStarred",
        "getCachedRepoSubscription",
        "getFileLatestCommits",
        "getForkComparison",
        "getPathCommits",
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
        "deleteRepoBranch",
        "getBranchDetails",
        "getBranchProtectionMap",
        "getBranchRefs",
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
        "renameRepoBranch",
        "revertPullRequest",
        "unstackPullRequests",
        "updateIssueComment",
        "updateIssueMilestone",
        "updatePullRequest",
        "updatePullRequestBranch",
        "updatePullRequestReview",
    ),
}));

vi.mock("~/server/codeberg", () => ({
    ...fns(
        "createIssueComment",
        "createIssueCommentReaction",
        "createIssueReaction",
        "deleteBranch",
        "deleteIssueComment",
        "deleteIssueCommentReaction",
        "deleteIssueReaction",
        "deleteRepoSubscription",
        "getCachedRepo",
        "getCachedRepoCounts",
        "getCachedRepoStarred",
        "getCachedRepoSubscription",
        "getBranches",
        "getCommitCombinedStatus",
        "getFileContent",
        "getFileLatestCommit",
        "getFileTree",
        "getLatestCommit",
        "getLatestRelease",
        "getPathCommits",
        "getRefCounts",
        "getRepoContents",
        "getRepoLanguages",
        "getTags",
        "getUser",
        "getUserByUsername",
        "getUserRepos",
        "listIssueCommentReactions",
        "listIssueReactions",
        "listIssueTimeline",
        "setRepoSubscription",
        "starRepo",
        "unstarRepo",
        "listAssignees",
        "listLabels",
        "listMilestones",
        "listRecentIssueAuthors",
        "renameBranch",
        "updateIssue",
        "updateIssueComment",
    ),
}));

vi.mock("~/server/api/routers/checks", () => ({
    PR_STATUS_BATCH_SIZE: 50,
    buildPrStatusBatchQuery: vi.fn(),
    extractMergeStateStatus: vi.fn(),
    extractStatusContexts: vi.fn(),
}));
vi.mock("@octokit/graphql", () => ({ graphql: vi.fn() }));

import { branchesRouter } from "~/server/api/routers/branches";
import { issuesRouter } from "~/server/api/routers/issues";
import { pullsRouter } from "~/server/api/routers/pulls";
import { reposRouter } from "~/server/api/routers/repos";
import { usersRouter } from "~/server/api/routers/users";
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
        issues: createCallerFactory(issuesRouter)(ctx),
        users: createCallerFactory(usersRouter)(ctx),
        branches: createCallerFactory(branchesRouter)(ctx),
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

describe("provider-aware procedures (issues router)", () => {
    it("adds a Codeberg comment with the Codeberg token", async () => {
        const { issues } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(codeberg.createIssueComment).mockResolvedValue({
            id: 42,
        } as never);

        await expect(
            issues.addComment({
                provider: "cb",
                owner: "acme",
                repo: "api",
                issueNumber: 3,
                body: "hi",
            }),
        ).resolves.toEqual({ success: true, id: 42 });

        expect(getCodebergTokenMock).toHaveBeenCalledWith({}, "user-1");
        expect(codeberg.createIssueComment).toHaveBeenCalledWith(
            "cb-token",
            "acme",
            "api",
            3,
            "hi",
        );
        expect(getGitHubTokenMock).not.toHaveBeenCalled();
    });

    it("returns mapped Codeberg timeline events and a page cursor", async () => {
        const { issues } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(codeberg.listIssueTimeline).mockResolvedValue({
            items: [
                {
                    id: 5,
                    type: "comment",
                    body: "hi",
                    created_at: "2026-01-01T00:00:00Z",
                    user: null,
                    label: null,
                    milestone: null,
                    assignee: null,
                },
            ],
            hasNextPage: true,
        } as never);
        vi.mocked(codeberg.getUser).mockResolvedValue({
            login: "alice",
        } as never);
        vi.mocked(codeberg.listIssueCommentReactions).mockResolvedValue(
            [] as never,
        );

        const result = await issues.timeline({
            provider: "cb",
            owner: "acme",
            repo: "api",
            issueNumber: 3,
            limit: 30,
        });

        expect(codeberg.listIssueTimeline).toHaveBeenCalledWith(
            "cb-token",
            "acme",
            "api",
            3,
            1,
            30,
        );
        expect(result.nextCursor).toBe("2");
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({
            __typename: "IssueComment",
            id: "5",
        });
        expect(result.currentUserLogin).toBe("alice");
    });
});

describe("users.currentUser (Codeberg)", () => {
    it("returns null for anonymous visitors without requesting a token", async () => {
        const { users } = await callerFor(null);

        await expect(users.currentUser({ provider: "cb" })).resolves.toBeNull();

        expect(getCodebergTokenMock).not.toHaveBeenCalled();
    });

    it("uses the Codeberg profile avatar instead of the shared session image", async () => {
        const { users } = await callerFor({
            user: {
                id: "user-1",
                codebergUsername: "ranger-ross",
                image: "https://github.com/avatars/ranger-ross.png",
            },
        });
        vi.mocked(codeberg.getUser).mockResolvedValue({
            login: "ranger-ross",
            avatar_url: "https://codeberg.org/avatars/ranger-ross.png",
        } as never);

        await expect(users.currentUser({ provider: "cb" })).resolves.toEqual({
            login: "ranger-ross",
            avatarUrl: "https://codeberg.org/avatars/ranger-ross.png",
        });
    });

    it("returns null when no Codeberg account is linked", async () => {
        const { users } = await callerFor({ user: { id: "user-1" } });
        getCodebergTokenMock.mockRejectedValue(
            new Error("Codeberg account not connected"),
        );

        await expect(users.currentUser({ provider: "cb" })).resolves.toBeNull();
    });
});

describe("issues.timeline cursor validation", () => {
    async function timelineWithCursor(cursor: string) {
        const { issues } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(codeberg.listIssueTimeline).mockResolvedValue({
            items: [],
            hasNextPage: false,
        } as never);

        const result = issues.timeline({
            provider: "cb",
            owner: "acme",
            repo: "api",
            issueNumber: 3,
            limit: 30,
            cursor,
        });

        return { result, page: vi.mocked(codeberg.listIssueTimeline) };
    }

    it("rejects malformed, fractional, zero and negative pages", async () => {
        for (const cursor of ["abc", "NaN", "1.5", "0", "-3"]) {
            const { result, page } = await timelineWithCursor(cursor);

            await expect(result).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
            expect(page).not.toHaveBeenCalled();
        }
    });

    it("keeps a valid page number", async () => {
        const { result, page } = await timelineWithCursor("4");

        await result;
        expect(page.mock.calls.at(-1)?.[4]).toBe(4);
    });
});

describe("branches router", () => {
    const refsPage = {
        refs: [{ name: "main", committedDate: "2026-09-01T00:00:00Z" }],
        totalCount: 1,
        hasNextPage: false,
        endCursor: null,
        defaultBranch: "main",
    };

    it("lists through the GitHub handler, resolving an anonymous user id", async () => {
        const { branches } = await callerFor(null);
        vi.mocked(github.getBranchRefs).mockResolvedValue(refsPage as never);
        vi.mocked(github.getBranchDetails).mockResolvedValue([] as never);
        vi.mocked(github.getBranchProtectionMap).mockResolvedValue({} as never);

        const result = await branches.list({ owner: "acme", repo: "api" });

        expect(getGitHubTokenMock).toHaveBeenCalledWith({}, "anonymous");
        expect(github.getBranchRefs).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            { query: null, direction: "DESC", pages: 3 },
        );
        expect(github.getBranchDetails).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            ["main"],
        );
        expect(result.items).toEqual([]);
        expect(result.defaultBranchRow?.name).toBe("main");
    });

    it("lists through the Codeberg handler when provider is cb", async () => {
        const { branches } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(codeberg.getBranches).mockResolvedValue([
            {
                name: "main",
                sha: "s1",
                isProtected: true,
                updatedAt: "2026-09-01T00:00:00Z",
                authorName: "Alice",
                authorUsername: "alice",
            },
        ] as never);
        vi.mocked(codeberg.getCachedRepo).mockResolvedValue({
            default_branch: "main",
        } as never);
        vi.mocked(codeberg.getCommitCombinedStatus).mockResolvedValue(null);
        vi.mocked(codeberg.getUserByUsername).mockResolvedValue({
            avatar_url: "https://codeberg.org/avatars/alice",
        } as never);

        const result = await branches.list({
            provider: "cb",
            owner: "acme",
            repo: "api",
            tab: "all",
        });

        expect(getCodebergTokenMock).toHaveBeenCalledWith({}, "user-1");
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            name: "main",
            isProtected: true,
            author: {
                login: "alice",
                name: "Alice",
                avatarUrl: "https://codeberg.org/avatars/alice",
            },
        });
    });

    it("refuses to delete or rename the default branch", async () => {
        const { branches } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.getCachedRepo).mockResolvedValue({
            default_branch: "main",
        } as never);

        await expect(
            branches.deleteBranch({
                owner: "acme",
                repo: "api",
                branch: "main",
            }),
        ).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: "The default branch cannot be deleted",
        });
        await expect(
            branches.renameBranch({
                owner: "acme",
                repo: "api",
                branch: "main",
                newName: "trunk",
            }),
        ).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: "The default branch cannot be renamed",
        });
        expect(github.deleteRepoBranch).not.toHaveBeenCalled();
        expect(github.renameRepoBranch).not.toHaveBeenCalled();
    });

    it("deletes a branch and surfaces the provider rejection", async () => {
        const { branches } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.getCachedRepo).mockResolvedValue({
            default_branch: "main",
        } as never);
        vi.mocked(github.deleteRepoBranch).mockResolvedValue(undefined);

        await expect(
            branches.deleteBranch({
                owner: "acme",
                repo: "api",
                branch: "feat/x",
            }),
        ).resolves.toEqual({ success: true });
        expect(github.deleteRepoBranch).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            "feat/x",
        );

        vi.mocked(github.deleteRepoBranch).mockRejectedValue(
            Object.assign(new Error("Branch is protected"), { status: 422 }),
        );
        await expect(
            branches.deleteBranch({
                owner: "acme",
                repo: "api",
                branch: "feat/x",
            }),
        ).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: "Branch is protected",
        });
    });

    it("renames a branch to the requested name", async () => {
        const { branches } = await callerFor({ user: { id: "user-1" } });
        vi.mocked(github.getCachedRepo).mockResolvedValue({
            default_branch: "main",
        } as never);
        vi.mocked(github.renameRepoBranch).mockResolvedValue(undefined);

        await expect(
            branches.renameBranch({
                owner: "acme",
                repo: "api",
                branch: "feat/x",
                newName: "feat/y",
            }),
        ).resolves.toEqual({ name: "feat/y" });
        expect(github.renameRepoBranch).toHaveBeenCalledWith(
            "gh-token",
            "acme",
            "api",
            "feat/x",
            "feat/y",
        );
    });
});
