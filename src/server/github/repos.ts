import type { RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";
import {
    repoContributorsCacheKey,
    repoDocFilesCacheKey,
    repoIssuePullCountsCacheKey,
    repoLanguagesCacheKey,
    repoStarredCacheKey,
    repoSubscriptionCacheKey,
    withStaleWhileRevalidate,
} from "~/server/cache";
import {
    createGraphql,
    type GQLCommitAuthor,
    getArchivedAtGraphQL,
    isOrgRestrictionError,
    resolveCommitAuthor,
} from "~/server/github-graphql";
import {
    getCachedRepoData,
    getRepoPermissionForUser,
    viewerRepoAccess,
} from "~/server/repo-cache";
import { githubRepoToSyncRepo } from "~/server/sync/mappers";
import { createOctokit } from "./client";
import {
    getRepoDocFileNames,
    getRepoLanguages,
    type RepoDocFileName,
} from "./contents";

export const getUserRepoPermission = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        username: string,
        userId: string,
    ) => {
        return withStaleWhileRevalidate(
            `permission:${owner}:${repo}:${userId}`,
            async () => {
                const octokit = createOctokit(accessToken);
                try {
                    const response =
                        await octokit.rest.repos.getCollaboratorPermissionLevel(
                            {
                                owner,
                                repo,
                                username,
                            },
                        );
                    return response.data.permission as
                        | "admin"
                        | "write"
                        | "read"
                        | "none";
                } catch (error) {
                    const status = (error as { status?: number } | null)
                        ?.status;
                    // 404: the user is not a collaborator, so they have no
                    // access. Return "none" so it is cached instead of
                    // re-fetching on every page view.
                    if (status === 404) {
                        return "none" as const;
                    }
                    throw error;
                }
            },
            { staleAfter: 5 * 60 * 1000, deleteAfter: 6 * 60 * 60 * 1000 },
        );
    },
);

/**
 * Resolves every collaborator's effective base permission for the repo in one
 * (paginated) call, keyed by login. The endpoint requires write/maintain/admin
 * access, so this returns null when the caller cannot list collaborators;
 * callers should fall back to per-user lookups via getUserRepoPermission.
 * Absent users have no access.
 */
export const getRepoCollaboratorPermissions = cache(
    async (
        accessToken: string,
        userId: string,
        owner: string,
        repo: string,
    ): Promise<Record<string, "admin" | "write" | "read" | "none"> | null> => {
        return withStaleWhileRevalidate(
            `gh:collaborators:${userId}:${owner}:${repo}`,
            async () => {
                const octokit = createOctokit(accessToken);
                const permissions: Record<
                    string,
                    "admin" | "write" | "read" | "none"
                > = {};
                try {
                    let page = 1;
                    for (;;) {
                        const response =
                            await octokit.rest.repos.listCollaborators({
                                owner,
                                repo,
                                per_page: 100,
                                page,
                            });
                        for (const collaborator of response.data) {
                            const p = collaborator.permissions;
                            // The permissions hash uses the legacy base roles:
                            // maintain implies push (write) and triage implies
                            // pull (read), matching getCollaboratorPermissionLevel.
                            permissions[collaborator.login] = p?.admin
                                ? "admin"
                                : p?.push
                                  ? "write"
                                  : p?.pull
                                    ? "read"
                                    : "none";
                        }
                        if (response.data.length < 100) break;
                        page += 1;
                    }
                    return permissions;
                } catch {
                    return null;
                }
            },
            { staleAfter: 5 * 60 * 1000, deleteAfter: 6 * 60 * 60 * 1000 },
        );
    },
);
export const getRepo = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.repos.get({ owner, repo });
        return response.data;
    },
);

export async function getCachedRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RestEndpointMethodTypes["repos"]["get"]["response"]["data"]> {
    return getCachedRepoData({
        provider: "github",
        owner,
        repo,
        staleAfterMs: 5 * 60 * 1000,
        fetcher: async () => {
            try {
                return await getRepo(accessToken, owner, repo);
            } catch (error) {
                // A missing repo surfaces as a 404 from the REST client; any
                // other failure (rate limit, outage) must propagate as-is.
                if ((error as { status?: number }).status === 404) return null;
                throw error;
            }
        },
        toRepo: (payload) => githubRepoToSyncRepo(payload),
    });
}

const getRepoIssuePullCounts = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<{
        openIssuesCount: number;
        openPullRequestsCount: number;
    } | null> => {
        const graphql = createGraphql(accessToken);

        const query = `
query GetRepoIssuePullCounts($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(states: OPEN) {
      totalCount
    }
    pullRequests(states: OPEN) {
      totalCount
    }
  }
}`;
        const result = await graphql<{
            repository?: {
                issues: {
                    totalCount: number;
                };
                pullRequests: {
                    totalCount: number;
                };
            };
        }>(query, {
            owner,
            repo,
        });

        if (!result?.repository) {
            return null;
        }

        return {
            openIssuesCount: result.repository.issues.totalCount,
            openPullRequestsCount: result.repository.pullRequests.totalCount,
        };
    },
);

export async function getCachedRepoIssuePullCounts(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<{ openIssuesCount: number; openPullRequestsCount: number } | null> {
    return withStaleWhileRevalidate(
        repoIssuePullCountsCacheKey("gh", userId, owner, repo),
        () => getRepoIssuePullCounts(accessToken, owner, repo),
        { staleAfter: 3_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export interface RepoHeaderInfo {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    archived: boolean;
    archivedAt: string | null;
    permissions: { admin: boolean; write: boolean };
    ownerAvatarUrl: string | null;
}

export async function getCachedRepoHeaderData(
    accessToken: string,
    username: string | null,
    owner: string,
    repo: string,
): Promise<RepoHeaderInfo | null> {
    const [repoInfo, permission] = await Promise.all([
        getCachedRepo(accessToken, owner, repo),
        getRepoPermissionForUser("github", username, owner, repo),
    ]);

    const access = viewerRepoAccess({
        username,
        payload: repoInfo,
        permission,
    });
    // The cached payload is shared across users; a viewer without a grant
    // must not see a private repo through it. Callers decide how to surface
    // the denial (this is resolved into a promise the header consumes, so a
    // server notFound() here could never produce a 404).
    if (!access.canView) return null;

    const archivedAt = repoInfo.archived
        ? await getArchivedAtGraphQL(accessToken, owner, repo).catch(() => null)
        : null;

    return {
        hasIssues: repoInfo.has_issues,
        hasWiki: repoInfo.has_wiki,
        hasProjects: repoInfo.has_projects,
        hasDiscussions: repoInfo.has_discussions,
        isPrivate: repoInfo.private,
        archived: repoInfo.archived,
        archivedAt,
        permissions: { admin: access.admin, write: access.write },
        ownerAvatarUrl: repoInfo.owner.avatar_url,
    };
}

export async function getCachedRepoLanguages(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<Record<string, number>> {
    return withStaleWhileRevalidate(
        repoLanguagesCacheKey(userId, owner, repo),
        () => getRepoLanguages(accessToken, owner, repo),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoContributors(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<RepoContributor[]> {
    return withStaleWhileRevalidate(
        repoContributorsCacheKey(userId, owner, repo),
        () => getRepoContributors(accessToken, owner, repo),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoDocFileNames(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFileName[]> {
    return withStaleWhileRevalidate(
        repoDocFilesCacheKey(userId, owner, repo, ref),
        () => getRepoDocFileNames(accessToken, owner, repo, ref),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoStarred(
    accessToken: string,
    owner: string,
    repo: string,
    userId: string,
): Promise<boolean> {
    return withStaleWhileRevalidate(
        repoStarredCacheKey("gh", userId, owner, repo),
        () => checkRepoStarred(accessToken, owner, repo),
        { staleAfter: 30_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
    userId: string,
): Promise<RepoSubscription | null> {
    return withStaleWhileRevalidate(
        repoSubscriptionCacheKey("gh", userId, owner, repo),
        () => getRepoSubscription(accessToken, owner, repo),
        { staleAfter: 30_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}
export type RepoListItem = {
    owner: string;
    name: string;
    fullName: string;
    private: boolean;
};

export async function getUserRepos(
    accessToken: string,
): Promise<RepoListItem[]> {
    const graphql = createGraphql(accessToken);

    const query = `
query ViewerRepos($first: Int!, $after: String) {
  viewer {
    repositories(
      first: $first
      after: $after
      ownerAffiliations: OWNER
      orderBy: { field: NAME, direction: ASC }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        owner {
          login
        }
        isPrivate
      }
    }
  }
}`;

    const results: RepoListItem[] = [];
    let cursor: string | null = null;
    for (;;) {
        const result: {
            viewer: {
                repositories: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: Array<{
                        name: string;
                        owner: { login: string };
                        isPrivate: boolean;
                    } | null>;
                };
            };
        } = await graphql<{
            viewer: {
                repositories: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: Array<{
                        name: string;
                        owner: { login: string };
                        isPrivate: boolean;
                    } | null>;
                };
            };
        }>(query, { first: 100, after: cursor });

        for (const r of result.viewer.repositories.nodes) {
            if (!r) continue;
            results.push({
                owner: r.owner.login,
                name: r.name,
                fullName: `${r.owner.login}/${r.name}`,
                private: r.isPrivate,
            });
        }

        if (!result.viewer.repositories.pageInfo.hasNextPage) break;
        cursor = result.viewer.repositories.pageInfo.endCursor;
    }

    return results;
}
export interface RepoBranch {
    name: string;
    sha: string;
}

export async function getRepoBranches(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoBranch[]> {
    const octokit = createOctokit(accessToken);
    const iterator = octokit.paginate.iterator(
        octokit.rest.repos.listBranches,
        { owner, repo, per_page: 100 },
    );

    const results: RepoBranch[] = [];
    for await (const { data } of iterator) {
        for (const branch of data) {
            results.push({
                name: branch.name,
                sha: branch.commit.sha,
            });
        }
    }
    return results;
}

export interface RepoTag {
    name: string;
    sha: string;
}

export async function getRepoTags(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoTag[]> {
    const octokit = createOctokit(accessToken);
    const iterator = octokit.paginate.iterator(octokit.rest.repos.listTags, {
        owner,
        repo,
        per_page: 100,
    });

    const results: RepoTag[] = [];
    for await (const { data } of iterator) {
        for (const tag of data) {
            results.push({
                name: tag.name,
                sha: tag.commit.sha,
            });
        }
    }
    return results;
}

export interface RepoContributor {
    login: string | null;
    avatarUrl: string | null;
    contributions: number;
}

export async function getRepoContributors(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoContributor[]> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 20,
    });

    return (data ?? []).map((contributor) => ({
        login: contributor.login ?? null,
        avatarUrl: contributor.avatar_url ?? null,
        contributions: contributor.contributions,
    }));
}

export interface RepoDeployment {
    id: string;
    environment: string;
    state: string;
    createdAt: string;
}

export async function getRepoDeployments(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoDeployment[]> {
    const graphql = createGraphql(accessToken);

    const query = `
query RepoDeployments($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    deployments(first: $first, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        id
        environment
        createdAt
        latestStatus {
          state
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                deployments?: {
                    nodes: Array<{
                        id: string;
                        environment: string | null;
                        createdAt: string;
                        latestStatus: { state: string } | null;
                    } | null>;
                } | null;
            } | null;
        }>(query, { owner, repo, first: 100 });

        const deployments = result.repository?.deployments?.nodes ?? [];

        const seen = new Set<string>();
        const results: RepoDeployment[] = [];
        for (const d of deployments) {
            if (!d) continue;
            // Newest first, so the first deployment seen per environment is
            // its latest; latestStatus already carries that deployment's
            // latest state.
            const env = d.environment ?? "";
            if (seen.has(env)) continue;
            seen.add(env);
            results.push({
                id: d.id,
                environment: env,
                state: d.latestStatus?.state.toLowerCase() ?? "inactive",
                createdAt: d.createdAt,
            });
        }

        return results;
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoDeploymentsRest(accessToken, owner, repo);
    }
}

/**
 * REST fallback for getRepoDeployments: one listDeployments call plus one
 * listDeploymentStatuses call per environment for its latest state.
 */
async function getRepoDeploymentsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoDeployment[]> {
    const octokit = createOctokit(accessToken);
    const { data: deployments } = await octokit.rest.repos.listDeployments({
        owner,
        repo,
        per_page: 100,
    });

    if (!deployments || deployments.length === 0) return [];

    const seen = new Set<string>();
    const latestPerEnv: typeof deployments = [];
    for (const d of deployments) {
        const env = d.environment ?? "";
        if (seen.has(env)) continue;
        seen.add(env);
        latestPerEnv.push(d);
    }

    const results = await Promise.all(
        latestPerEnv.map(async (d) => {
            const { data: statuses } =
                await octokit.rest.repos.listDeploymentStatuses({
                    owner,
                    repo,
                    deployment_id: d.id,
                    per_page: 1,
                });
            const latestStatus = statuses[0];
            return {
                id: String(d.id),
                environment: d.environment ?? "",
                state: latestStatus?.state ?? "inactive",
                createdAt: d.created_at,
            };
        }),
    );

    return results;
}

export interface RepoRelease {
    name: string;
    tagName: string;
    createdAt: string;
    htmlUrl: string;
}

export async function getLatestRelease(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRelease | null> {
    const octokit = createOctokit(accessToken);
    try {
        const { data } = await octokit.rest.repos.getLatestRelease({
            owner,
            repo,
        });
        return {
            name: data.name ?? data.tag_name,
            tagName: data.tag_name,
            createdAt: data.created_at,
            htmlUrl: data.html_url,
        };
    } catch {
        return null;
    }
}

export interface RepoSubscription {
    subscribed: boolean;
    ignored: boolean;
}

export async function checkRepoStarred(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<boolean> {
    const octokit = createOctokit(accessToken);
    try {
        await octokit.rest.activity.checkRepoIsStarredByAuthenticatedUser({
            owner,
            repo,
        });
        return true;
    } catch {
        return false;
    }
}

export async function starRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.starRepoForAuthenticatedUser({ owner, repo });
}

export async function unstarRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo,
    });
}

export async function getRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoSubscription | null> {
    const octokit = createOctokit(accessToken);
    try {
        const { data } = await octokit.rest.activity.getRepoSubscription({
            owner,
            repo,
        });
        return {
            subscribed: data.subscribed,
            ignored: data.ignored,
        };
    } catch {
        return null;
    }
}

export async function setRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
    subscribed: boolean,
    ignored: boolean,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    if (!subscribed && !ignored) {
        await octokit.rest.activity.deleteRepoSubscription({ owner, repo });
        return;
    }
    await octokit.rest.activity.setRepoSubscription({
        owner,
        repo,
        subscribed,
        ignored,
    });
}

export async function deleteRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.deleteRepoSubscription({ owner, repo });
}

export interface RepoRefCounts {
    branchCount: number;
    tagCount: number;
}

export async function getRepoRefCounts(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRefCounts> {
    const graphql = createGraphql(accessToken);

    const query = `
query RepoRefCounts($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    branches: refs(refPrefix: "refs/heads/") {
      totalCount
    }
    tags: refs(refPrefix: "refs/tags/") {
      totalCount
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                branches: { totalCount: number };
                tags: { totalCount: number };
            } | null;
        }>(query, { owner, repo });

        if (!result.repository) {
            throw new Error(`Repository not found: ${owner}/${repo}`);
        }

        return {
            branchCount: result.repository.branches.totalCount,
            tagCount: result.repository.tags.totalCount,
        };
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoRefCountsRest(accessToken, owner, repo);
    }
}

/**
 * REST fallback for getRepoRefCounts: listBranches/listTags with per_page=1,
 * deriving the totals from the Link header pagination metadata.
 */
async function getRepoRefCountsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRefCounts> {
    const octokit = createOctokit(accessToken);
    const [branchRes, tagRes] = await Promise.all([
        octokit.rest.repos.listBranches({ owner, repo, per_page: 1 }),
        octokit.rest.repos.listTags({ owner, repo, per_page: 1 }),
    ]);

    return {
        branchCount: parseRefCountFromLinkHeader(
            branchRes.headers.link,
            branchRes.data.length,
        ),
        tagCount: parseRefCountFromLinkHeader(
            tagRes.headers.link,
            tagRes.data.length,
        ),
    };
}

function parseRefCountFromLinkHeader(
    linkHeader: string | undefined,
    currentCount: number,
): number {
    if (!linkHeader) return currentCount;

    const linkPattern = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/g;
    let maxPage = 1;
    for (const m of linkHeader.matchAll(linkPattern)) {
        const p = Number.parseInt(m[1] ?? "0", 10);
        if (p > maxPage) maxPage = p;
    }

    if (maxPage <= 1) return currentCount;
    return maxPage;
}

export interface RepoLatestCommit {
    sha: string;
    message: string;
    author: {
        login: string;
        avatarUrl: string;
    } | null;
    committedDate: string | null;
    commitCount: number;
}

export async function getRepoLatestCommit(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoLatestCommit> {
    const graphql = createGraphql(accessToken);

    const query = `
query RepoLatestCommit($owner: String!, $repo: String!, $expression: String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Commit {
        oid
        messageHeadline
        committedDate
        authors(first: 1) {
          nodes {
            name
            email
            avatarUrl
            user {
              __typename
              login
              avatarUrl
              url
            }
          }
        }
        history {
          totalCount
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                object?: {
                    oid: string;
                    messageHeadline: string;
                    committedDate: string | null;
                    authors: { nodes: (GQLCommitAuthor | null)[] };
                    history: { totalCount: number };
                } | null;
            } | null;
        }>(query, { owner, repo, expression: ref ?? "HEAD" });

        const commit = result.repository?.object ?? null;
        if (!commit) {
            throw new Error(`No commits found for ${owner}/${repo}`);
        }

        // Commit.author is a GitActor (git identity, no GitHub login); resolve
        // the GitHub user the same way the commit list does, synthesizing it
        // from noreply emails when the user connection fails to resolve.
        const author = commit.authors.nodes[0]
            ? resolveCommitAuthor(commit.authors.nodes[0]).user
            : null;

        return {
            sha: commit.oid,
            message: commit.messageHeadline,
            author: author
                ? { login: author.login, avatarUrl: author.avatarUrl }
                : null,
            committedDate: commit.committedDate,
            commitCount: commit.history.totalCount,
        };
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoLatestCommitRest(accessToken, owner, repo, ref);
    }
}

/**
 * REST fallback for getRepoLatestCommit: listCommits with per_page=1,
 * deriving the commit count from the Link header pagination metadata.
 */
async function getRepoLatestCommitRest(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoLatestCommit> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: ref,
        per_page: 1,
    });

    const commit = response.data[0];
    if (!commit) {
        throw new Error(`No commits found for ${owner}/${repo}`);
    }

    const commitCount = parseRefCountFromLinkHeader(
        response.headers.link,
        response.data.length,
    );

    const message = commit.commit.message.split("\n")[0] ?? "";

    return {
        sha: commit.sha,
        message,
        author: commit.author
            ? {
                  login: commit.author.login,
                  avatarUrl: commit.author.avatar_url,
              }
            : null,
        committedDate:
            commit.commit.committer?.date ?? commit.commit.author?.date ?? null,
        commitCount,
    };
}

export interface ForkComparison {
    aheadBy: number;
    behindBy: number;
}

export async function getForkComparison(
    accessToken: string,
    owner: string,
    repo: string,
    upstreamFullName: string,
    forkBranch: string,
    parentBranch: string,
): Promise<ForkComparison> {
    const octokit = createOctokit(accessToken);

    const [parentOwner] = upstreamFullName.split("/");
    if (!parentOwner) {
        throw new Error(`Invalid upstream full name: ${upstreamFullName}`);
    }

    const comparison = await octokit.request(
        "GET /repos/{owner}/{repo}/compare/{basehead}",
        {
            owner,
            repo,
            basehead: `${parentOwner}:${parentBranch}...${owner}:${forkBranch}`,
        },
    );

    return {
        aheadBy: comparison.data.ahead_by,
        behindBy: comparison.data.behind_by,
    };
}

export async function mergeForkUpstream(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
): Promise<{ message: string | null; mergeType: string | null }> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.request(
        "POST /repos/{owner}/{repo}/merge-upstream",
        {
            owner,
            repo,
            branch,
        },
    );

    return {
        message: response.data.message ?? null,
        mergeType: response.data.merge_type ?? null,
    };
}
