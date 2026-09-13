import { TRPCError } from "@trpc/server";
import { cache } from "react";
import {
    repoIssuePullCountsCacheKey,
    repoStarredCacheKey,
    repoSubscriptionCacheKey,
    withStaleWhileRevalidate,
} from "~/server/cache";
import {
    getCachedRepoData,
    getRepoPermissionForUser,
    viewerRepoAccess,
} from "~/server/repo-cache";
import { codebergRepoToSyncRepo } from "~/server/sync/mappers";

export const CODEBERG_API = "https://codeberg.org";

export type CodebergUser = {
    id: number;
    login: string;
    username: string;
    full_name: string;
    email: string;
    avatar_url: string;
};

export type CodebergPullRequest = {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed";
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    draft: boolean;
    body: string;
    user: {
        id: number;
        login: string;
        full_name: string;
        avatar_url: string;
    } | null;
    assignees: Array<{
        id: number;
        login: string;
        avatar_url: string;
    }> | null;
    labels: Array<{
        id: number;
        name: string;
        color: string;
        description: string | null;
    }> | null;
    milestone: {
        id: number;
        title: string;
    } | null;
    comments: number | null;
    head: {
        label: string;
        ref: string;
        sha: string;
    };
    base: {
        label: string;
        ref: string;
        sha: string;
    };
};

export type CodebergPullRequestSort =
    | "oldest"
    | "recentupdate"
    | "newest"
    | "leastupdate"
    | "mostcomment"
    | "leastcomment";

export type CodebergPrListParams = {
    state?: "open" | "closed" | "all";
    sort?:
        | "oldest"
        | "recentupdate"
        | "newest"
        | "leastupdate"
        | "mostcomment"
        | "leastcomment";
    page?: number;
    limit?: number;
    author?: string;
    labels?: string[];
};

// Applies one has:/no: filter; an absent filter matches everything.
function matchesPresence(
    present: boolean,
    filter: PresenceFilter | undefined,
): boolean {
    return filter === undefined || present === (filter === "has");
}

function parseTotalCountFromLinkHeader(
    linkHeader: string | null,
    totalFromHeader: string | null,
    limit: number,
    currentCount: number,
    page: number,
): number {
    // Gitea reports the exact total in X-Total-Count on list endpoints.
    const headerTotal = Number.parseInt(totalFromHeader ?? "", 10);
    if (Number.isFinite(headerTotal) && headerTotal > 0) return headerTotal;

    if (!linkHeader) return currentCount;

    // Extract all page numbers from link relations
    const linkPattern = /<[^>]*page=(\d+)[^>]*>;\s*rel="(\w+)"/g;
    let maxPage = page;
    const matches = linkHeader.matchAll(linkPattern);
    for (const m of matches) {
        const p = Number.parseInt(m[1] ?? "0", 10);
        if (p > maxPage) maxPage = p;
    }

    if (maxPage > page) {
        // More pages beyond current; estimate assuming a full final page.
        return Math.max((maxPage - 1) * limit + currentCount, currentCount);
    }

    // Current page is the last one; earlier pages are full by definition.
    return (page - 1) * limit + currentCount;
}

export const listPullRequests = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        params: CodebergPrListParams = {},
    ) => {
        const searchParams = new URLSearchParams();
        if (params.state) searchParams.set("state", params.state);
        if (params.sort) searchParams.set("sort", params.sort);
        if (params.page) searchParams.set("page", String(params.page));
        if (params.limit) searchParams.set("limit", String(params.limit));

        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/pulls?${searchParams}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return { items: [], totalCount: 0 };

        let items = (await res.json()) as CodebergPullRequest[];

        if (params.author) {
            items = items.filter(
                (pr) =>
                    pr.user?.login.toLowerCase() ===
                    params.author?.toLowerCase(),
            );
        }

        if (params.labels && params.labels.length > 0) {
            items = items.filter((pr) => {
                const prLabelNames = (pr.labels ?? []).map((l) =>
                    l.name.toLowerCase(),
                );
                return params.labels?.every((label) =>
                    prLabelNames.includes(label.toLowerCase()),
                );
            });
        }

        const limit = params.limit ?? 30;

        const linkHeader = res.headers.get("Link");
        const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

        const page = params.page ?? 1;
        const totalCount = parseTotalCountFromLinkHeader(
            linkHeader,
            res.headers.get("X-Total-Count"),
            limit,
            items.length,
            page,
        );

        return { items, totalCount, hasNextPage };
    },
);

export const getUser = cache(
    async (accessToken: string): Promise<CodebergUser | null> => {
        const res = await fetch(`${CODEBERG_API}/api/v1/user`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return null;
        return res.json();
    },
);

export type CodebergLabel = {
    id: number;
    name: string;
    color: string;
    description: string | null;
};

export const listLabels = async (
    accessToken: string,
    owner: string,
    repo: string,
): Promise<CodebergLabel[]> => {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/labels`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) return [];
    return res.json();
};

export type CodebergMilestone = {
    id: number;
    title: string;
    description: string | null;
    state: string;
    open_issues: number;
    closed_issues: number;
};

export const listMilestones = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<CodebergMilestone[]> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/milestones?state=open`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        return res.json();
    },
);

export type CodebergAssignee = {
    id: number;
    login: string;
    avatar_url: string;
};

export const listAssignees = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<CodebergAssignee[]> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/assignees`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        return res.json();
    },
);

export type CodebergUserByUsername = {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
    description: string;
    location: string;
    website: string;
    created_at: string;
    followers_count: number;
    following_count: number;
};

export const getUserByUsername = cache(
    async (
        accessToken: string,
        username: string,
    ): Promise<CodebergUserByUsername | null> => {
        const res = await fetch(`${CODEBERG_API}/api/v1/users/${username}`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return null;
        return res.json();
    },
);

export type CodebergRepo = {
    id: number;
    owner: { id: number; login: string; avatar_url: string };
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    fork: boolean;
    parent: {
        full_name: string;
        default_branch: string | null;
    } | null;
    mirror: boolean;
    stars_count: number;
    forks_count: number;
    watchers_count: number;
    language: string | null;
    topics: string[];
    license: { name: string; url: string | null } | null;
    default_branch: string | null;
    website: string | null;
    created_at: string | null;
    updated_at: string | null;
    archived: boolean;
    archived_at: string | null;
    has_issues: boolean;
    has_wiki: boolean;
    has_projects: boolean;
    has_pull_requests: boolean;
    permissions: { admin: boolean; push: boolean; pull: boolean };
    allow_merge_commits: boolean;
    allow_rebase: boolean;
    allow_squash_merge: boolean;
    clone_url: string;
    ssh_url: string;
};

export const getRepo = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<CodebergRepo | null> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return null;
        return res.json();
    },
);

export async function getCachedRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<CodebergRepo> {
    return getCachedRepoData({
        provider: "codeberg",
        owner,
        repo,
        staleAfterMs: 5 * 60 * 1000,
        fetcher: () => getRepo(accessToken, owner, repo),
        // The single-repo endpoint does not say whether the owner is an org;
        // cache-created accounts default to "user" and a later permission
        // sync corrects the type.
        toRepo: (payload) => codebergRepoToSyncRepo(payload, "user"),
    });
}

type CodebergBranchRaw = {
    name: string;
    commit: { id: string };
};

type CodebergTagRaw = {
    name: string;
    commit: { sha: string };
};

type CodebergContentRaw = {
    type: "file" | "dir" | "submodule" | "symlink";
    name: string;
    path: string;
    sha: string;
    size: number;
    html_url: string | null;
};

type CodebergTreeItemRaw = {
    path: string;
    type: "blob" | "tree";
    sha: string;
    size: number;
};

export type CodebergCommitRaw = {
    sha: string;
    commit: {
        message: string;
        author: { name: string; email: string; date: string };
        committer: { name: string; email: string; date: string };
    };
    author: { login: string; avatar_url: string } | null;
};

type CodebergReleaseRaw = {
    name: string;
    tag_name: string;
    created_at: string;
    html_url: string;
};

export const getBranches = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/branches`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        const branches = (await res.json()) as CodebergBranchRaw[];
        return branches.map((b) => ({ name: b.name, sha: b.commit.id }));
    },
);

type CodebergActivityRaw = {
    op_type: string;
    ref_name: string | null;
    created: string;
    act_user: { login: string } | null;
};

export type CodebergActivity = {
    opType: string;
    refName: string | null;
    created: string;
    actorLogin: string | null;
};

/** Repository activity feed (pushes, branch changes), newest first. */
export const listRepoActivity = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        limit = 50,
    ): Promise<CodebergActivity[]> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/activities/feeds?limit=${limit}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        const entries = (await res.json()) as CodebergActivityRaw[];
        return entries.map((entry) => ({
            opType: entry.op_type,
            refName: entry.ref_name || null,
            created: entry.created,
            actorLogin: entry.act_user?.login || null,
        }));
    },
);

/**
 * Pull request for a base/head pair, or null when Forgejo reports none.
 * Network and permission failures also resolve to null: callers use this for
 * best-effort UI hints, not for authorization.
 */
export async function findPullRequestForBranches(
    accessToken: string,
    owner: string,
    repo: string,
    base: string,
    head: string,
): Promise<{ number: number; state: string; merged: boolean } | null> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/pulls/${encodeURIComponent(base)}/${head
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) return null;
    const pr = (await res.json()) as {
        number: number;
        state: string;
        merged: boolean | null;
    };
    return {
        number: pr.number,
        state: pr.state,
        merged: pr.merged === true,
    };
}

export const getTags = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/tags`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        const tags = (await res.json()) as CodebergTagRaw[];
        return tags.map((t) => ({ name: t.name, sha: t.commit.sha }));
    },
);

export async function getRefCounts(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<{ branchCount: number; tagCount: number }> {
    const [branchesRes, tagsRes] = await Promise.all([
        fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/branches?limit=1`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        ),
        fetch(`${CODEBERG_API}/api/v1/repos/${owner}/${repo}/tags?limit=1`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        }),
    ]);

    const parsePageCount = (res: Response): number => {
        if (!res.ok) return 0;
        const linkHeader = res.headers.get("Link");
        if (!linkHeader) return 0;
        const lastMatch = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(
            linkHeader,
        );
        if (lastMatch?.[1]) return Number.parseInt(lastMatch[1], 10);
        return 0;
    };

    return {
        branchCount: parsePageCount(branchesRes),
        tagCount: parsePageCount(tagsRes),
    };
}

export const getLatestCommit = cache(
    async (accessToken: string, owner: string, repo: string, ref?: string) => {
        const params = new URLSearchParams({ limit: "1" });
        if (ref) params.set("sha", ref);

        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/commits?${params}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) throw new Error(`No commits found for ${owner}/${repo}`);

        const commits = (await res.json()) as CodebergCommitRaw[];
        const commit = commits[0];
        if (!commit) throw new Error(`No commits found for ${owner}/${repo}`);

        const linkHeader = res.headers.get("Link");
        let commitCount = 1;
        if (linkHeader) {
            const lastMatch = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(
                linkHeader,
            );
            if (lastMatch?.[1]) commitCount = Number.parseInt(lastMatch[1], 10);
        }

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
                commit.commit.committer?.date ??
                commit.commit.author?.date ??
                null,
            commitCount,
        };
    },
);

export const getFileLatestCommit = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        ref: string,
        filePath: string,
    ) => {
        const params = new URLSearchParams({
            limit: "1",
            path: filePath,
        });
        if (ref) params.set("sha", ref);

        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/commits?${params}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return null;

        const commits = (await res.json()) as CodebergCommitRaw[];
        const commit = commits[0];
        if (!commit) return null;

        return {
            sha: commit.sha,
            message: commit.commit.message.split("\n")[0] ?? "",
            committedDate:
                commit.commit.committer?.date ??
                commit.commit.author?.date ??
                null,
        };
    },
);

export const getRepoContents = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        path?: string,
        ref?: string,
    ) => {
        const params = new URLSearchParams();
        if (ref) params.set("ref", ref);

        const urlPath = path ? `/${path}` : "";
        const query = params.toString();
        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/contents${urlPath}${query ? `?${query}` : ""}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return [];

        const data = (await res.json()) as
            | CodebergContentRaw
            | CodebergContentRaw[];
        const items = Array.isArray(data) ? data : [data];

        return items.map((item) => ({
            type: item.type,
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            htmlUrl: item.html_url ?? null,
        }));
    },
);

export const getFileTree = cache(
    async (accessToken: string, owner: string, repo: string, ref: string) => {
        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return [];

        const data = (await res.json()) as {
            tree: CodebergTreeItemRaw[];
        };

        return data.tree.map((item) => ({
            name: item.path.split("/").pop() ?? item.path,
            path: item.path,
            sha: item.sha,
            htmlUrl: `https://codeberg.org/${owner}/${repo}/src/branch/${encodeURIComponent(ref)}/${item.path.split("/").map(encodeURIComponent).join("/")}`,
            type: item.type,
        }));
    },
);

export const getFileContent = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        path: string,
        ref?: string,
    ) => {
        const params = new URLSearchParams();
        if (ref) params.set("ref", ref);

        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/contents/${path}?${params}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) throw new Error(`File not found: ${path}`);

        const data = (await res.json()) as {
            encoding?: string | null;
            content?: string | null;
        };
        if (!data.content) throw new Error(`File not found: ${path}`);

        const decoded =
            data.encoding === "base64"
                ? Buffer.from(data.content, "base64").toString("utf-8")
                : data.content;

        return { content: decoded };
    },
);

export const getRepoLanguages = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/languages`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return {};
        return res.json() as Promise<Record<string, number>>;
    },
);

export const getLatestRelease = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/releases?limit=1`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return null;
        const releases = (await res.json()) as CodebergReleaseRaw[];
        const release = releases[0];
        if (!release) return null;
        return {
            name: release.name,
            tagName: release.tag_name,
            createdAt: release.created_at,
            htmlUrl: release.html_url,
        };
    },
);

const getRepoCounts = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<{ openIssuesCount: number; openPullRequestsCount: number }> => {
        const [issues, pulls] = await Promise.all([
            fetch(
                `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues?state=open&limit=1&type=issues`,
                {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: "application/json",
                    },
                },
            ),
            fetch(
                `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/pulls?state=open&limit=1`,
                {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: "application/json",
                    },
                },
            ),
        ]);

        const parseCount = async (res: Response): Promise<number> => {
            if (!res.ok) return 0;
            const items = (await res.json()) as unknown[];
            const linkHeader = res.headers.get("Link");
            const limit = 1;
            return parseTotalCountFromLinkHeader(
                linkHeader,
                res.headers.get("X-Total-Count"),
                limit,
                items.length,
                1,
            );
        };

        const [openIssuesCount, openPullRequestsCount] = await Promise.all([
            parseCount(issues),
            parseCount(pulls),
        ]);

        return { openIssuesCount, openPullRequestsCount };
    },
);

export const listRecentIssueAuthors = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues?state=all&sort=created&direction=desc&limit=100`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        const issues = (await res.json()) as Array<{
            user: { login: string; avatar_url: string } | null;
        }>;
        const seen = new Set<string>();
        const authors: Array<{ login: string; avatar_url: string }> = [];
        for (const issue of issues) {
            if (issue.user && !seen.has(issue.user.login)) {
                seen.add(issue.user.login);
                authors.push({
                    login: issue.user.login,
                    avatar_url: issue.user.avatar_url,
                });
            }
        }
        return authors;
    },
);

type GiteaCommitStatus = {
    context: string;
    status: string;
    description: string | null;
    target_url: string | null;
    created_at: string;
    updated_at: string;
};

type GiteaCombinedStatus = {
    state: string;
    sha: string;
    total_count: number;
    statuses: GiteaCommitStatus[];
};
export async function getCommitCombinedStatus(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
): Promise<GiteaCombinedStatus | null> {
    const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/commits/${sha}/status`;
    const res = await fetch(url, {
        headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/json",
        },
    });
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(
            `Failed to fetch commit status for ${owner}/${repo}/${sha}: ${res.status}`,
        );
    }
    const data = (await res.json()) as GiteaCombinedStatus;
    return {
        ...data,
        statuses: data.statuses ?? [],
    };
}
export const listBranchCommits = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        branch: string,
        opts: { page?: number; limit?: number; author?: string },
    ): Promise<{
        commits: CodebergCommitRaw[];
        totalCount: number;
    }> => {
        const params = new URLSearchParams({
            sha: branch,
            limit: String(opts.limit ?? 35),
            page: String(opts.page ?? 1),
        });
        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/commits?${params}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(
                    `Branch ${branch} not found in ${owner}/${repo}`,
                );
            }
            throw new Error(
                `Failed to list commits for ${owner}/${repo}/${branch}: ${res.status}`,
            );
        }
        const commits = (await res.json()) as CodebergCommitRaw[];
        const totalCount = parseTotalCountFromLinkHeader(
            res.headers.get("Link"),
            res.headers.get("X-Total-Count"),
            opts.limit ?? 35,
            commits.length,
            opts.page ?? 1,
        );
        return { commits, totalCount };
    },
);

export type CodebergIssue = {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed";
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    body: string;
    user: {
        id: number;
        login: string;
        full_name: string;
        avatar_url: string;
    } | null;
    assignees: Array<{
        id: number;
        login: string;
        avatar_url: string;
    }> | null;
    labels: Array<{
        id: number;
        name: string;
        color: string;
        description: string | null;
    }> | null;
    milestone: {
        id: number;
        title: string;
    } | null;
    comments: number | null;
    pull_request?: {
        url: string;
    } | null;
};

export type CodebergIssueSort =
    | "oldest"
    | "recentupdate"
    | "newest"
    | "leastupdate"
    | "mostcomment"
    | "leastcomment";

export type PresenceFilter = "has" | "no";

/**
 * has:/no: metadata filters for issue search: "has" keeps issues where the
 * metadata is present, "no" where it is absent. Forgejo cannot filter on
 * presence, so listIssues applies these to the fetched page.
 */
export type MetadataPresence = Partial<{
    assignee: PresenceFilter;
    label: PresenceFilter;
    milestone: PresenceFilter;
}>;

export type CodebergIssueListParams = {
    state?: "open" | "closed" | "all";
    sort?: CodebergIssueSort;
    page?: number;
    limit?: number;
    author?: string;
    labels?: string[];
    presence?: MetadataPresence;
    // Free-text terms for Forgejo's `q`, already translated to its +term/-term
    // form. Qualifiers never travel here; they are applied by the provider.
    query?: string;
};

export const listIssues = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        params: CodebergIssueListParams = {},
    ) => {
        const searchParams = new URLSearchParams();
        searchParams.set("type", "issues");
        if (params.query) searchParams.set("q", params.query);
        if (params.state) searchParams.set("state", params.state);
        if (params.sort) searchParams.set("sort", params.sort);
        if (params.page) searchParams.set("page", String(params.page));
        if (params.limit) searchParams.set("limit", String(params.limit));

        const url = `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues?${searchParams}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return { items: [], totalCount: 0 };

        let items = (await res.json()) as CodebergIssue[];

        items = items.filter((issue) => !issue.pull_request);

        if (params.author) {
            items = items.filter(
                (issue) =>
                    issue.user?.login.toLowerCase() ===
                    params.author?.toLowerCase(),
            );
        }

        if (params.labels && params.labels.length > 0) {
            items = items.filter((issue) => {
                const issueLabelNames = (issue.labels ?? []).map((l) =>
                    l.name.toLowerCase(),
                );
                return params.labels?.every((label) =>
                    issueLabelNames.includes(label.toLowerCase()),
                );
            });
        }

        if (params.presence) {
            const { presence } = params;
            items = items.filter(
                (issue) =>
                    matchesPresence(
                        (issue.assignees?.length ?? 0) > 0,
                        presence.assignee,
                    ) &&
                    matchesPresence(
                        (issue.labels?.length ?? 0) > 0,
                        presence.label,
                    ) &&
                    matchesPresence(
                        issue.milestone != null,
                        presence.milestone,
                    ),
            );
        }

        const limit = params.limit ?? 30;

        const linkHeader = res.headers.get("Link");
        const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

        const page = params.page ?? 1;
        const totalCount = parseTotalCountFromLinkHeader(
            linkHeader,
            res.headers.get("X-Total-Count"),
            limit,
            items.length,
            page,
        );

        return { items, totalCount, hasNextPage };
    },
);

export const getIssue = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ) => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) {
            if (res.status === 404) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Issue ${issueNumber} not found in ${owner}/${repo}`,
                });
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to fetch issue ${issueNumber} in ${owner}/${repo}: ${res.status}`,
            });
        }
        return res.json() as Promise<CodebergIssue>;
    },
);

export const searchIssues = cache(
    async (accessToken: string, owner: string, repo: string, query: string) => {
        const searchParams = new URLSearchParams();
        searchParams.set("type", "issues");
        searchParams.set("limit", "5");
        if (query) searchParams.set("q", query);

        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues?${searchParams}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        const items = (await res.json()) as CodebergIssue[];
        return items
            .filter((issue) => !issue.pull_request)
            .map((issue) => ({
                number: issue.number,
                title: issue.title,
                state: issue.state,
                type: "issue" as const,
                user: issue.user ? { login: issue.user.login } : null,
            }));
    },
);

type CodebergTimelineActor = {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
};

export type CodebergComment = {
    id: number;
    html_url: string;
    issue_url: string;
    body: string;
    created_at: string;
    updated_at: string;
    user: CodebergTimelineActor | null;
};

// Only the fields the timeline adapter reads.
export type CodebergTimelineEntry = {
    id: number;
    type: string;
    body: string;
    created_at: string;
    user: CodebergTimelineActor | null;
    label: {
        id: number;
        name: string;
        color: string;
        description?: string | null;
    } | null;
    milestone: { id: number; title: string } | null;
    old_milestone?: { id: number; title: string } | null;
    assignee: {
        id: number;
        login: string;
        avatar_url: string;
        html_url: string;
    } | null;
    removed_assignee?: boolean;
    old_title?: string;
    new_title?: string;
};

export type CodebergReaction = {
    content: string;
    created_at: string;
    user: { login: string; avatar_url: string } | null;
};

// Forgejo write helper: JSON body when present, TRPCError on a non-OK status.
async function forgejoWrite(
    accessToken: string,
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body: unknown,
    failure: string,
): Promise<Response> {
    const res = await fetch(`${CODEBERG_API}/api/v1${path}`, {
        method,
        headers: {
            Authorization: `token ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `${failure}: ${res.status}`,
        });
    }
    return res;
}

// Forgejo caps a page at max_response_items (50); request more and it errors.
const TIMELINE_MAX_LIMIT = 50;

export const listIssueTimeline = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
        page: number,
        limit: number,
    ): Promise<{ items: CodebergTimelineEntry[]; hasNextPage: boolean }> => {
        const effectiveLimit = Math.min(limit, TIMELINE_MAX_LIMIT);
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues/${issueNumber}/timeline?page=${page}&limit=${effectiveLimit}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) {
            if (res.status === 404) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Issue ${issueNumber} not found in ${owner}/${repo}`,
                });
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to fetch issue timeline ${issueNumber} in ${owner}/${repo}: ${res.status}`,
            });
        }
        const items = (await res.json()) as CodebergTimelineEntry[];
        // Forgejo sends no Link header today; treat a full page as "more".
        const hasNextPage =
            (res.headers.get("Link")?.includes('rel="next"') ?? false) ||
            items.length === effectiveLimit;
        return { items, hasNextPage };
    },
);

export const createIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
): Promise<CodebergComment> => {
    const res = await forgejoWrite(
        accessToken,
        "POST",
        `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        { body },
        `Failed to create comment in ${owner}/${repo}`,
    );
    return res.json() as Promise<CodebergComment>;
};

export const updateIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    body: string,
): Promise<CodebergComment> => {
    const res = await forgejoWrite(
        accessToken,
        "PATCH",
        `/repos/${owner}/${repo}/issues/comments/${commentId}`,
        { body },
        `Failed to update comment ${commentId} in ${owner}/${repo}`,
    );
    return res.json() as Promise<CodebergComment>;
};

export const deleteIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
): Promise<void> => {
    await forgejoWrite(
        accessToken,
        "DELETE",
        `/repos/${owner}/${repo}/issues/comments/${commentId}`,
        undefined,
        `Failed to delete comment ${commentId} in ${owner}/${repo}`,
    );
};

export const updateIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    fields: { title?: string; body?: string; state?: "open" | "closed" },
): Promise<CodebergIssue> => {
    const res = await forgejoWrite(
        accessToken,
        "PATCH",
        `/repos/${owner}/${repo}/issues/${issueNumber}`,
        fields,
        `Failed to update issue ${issueNumber} in ${owner}/${repo}`,
    );
    return res.json() as Promise<CodebergIssue>;
};

export const listIssueReactions = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ): Promise<CodebergReaction[]> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        return (await res.json()) as CodebergReaction[];
    },
);

export const listIssueCommentReactions = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commentId: number,
    ): Promise<CodebergReaction[]> => {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) return [];
        return (await res.json()) as CodebergReaction[];
    },
);

export const createIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    content: string,
): Promise<void> => {
    await forgejoWrite(
        accessToken,
        "POST",
        `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
        { content },
        `Failed to add reaction to issue ${issueNumber} in ${owner}/${repo}`,
    );
};

export const createIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
): Promise<void> => {
    await forgejoWrite(
        accessToken,
        "POST",
        `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
        { content },
        `Failed to add reaction to comment ${commentId} in ${owner}/${repo}`,
    );
};

export const deleteIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    content: string,
): Promise<void> => {
    // Forgejo deletes by content, not by reaction id.
    await forgejoWrite(
        accessToken,
        "DELETE",
        `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
        { content },
        `Failed to remove reaction from issue ${issueNumber} in ${owner}/${repo}`,
    );
};

export const deleteIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
): Promise<void> => {
    await forgejoWrite(
        accessToken,
        "DELETE",
        `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
        { content },
        `Failed to remove reaction from comment ${commentId} in ${owner}/${repo}`,
    );
};

export interface CodebergRepoHeaderInfo {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    archived: boolean;
    archivedAt: string | null;
    permissions: { admin: boolean; write: boolean };
    ownerAvatarUrl: string | null;
    allowSquashMerge: boolean;
    allowRebaseMerge: boolean;
    allowMergeCommit: boolean;
    defaultBranch: string | null;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
}

export async function getCachedRepoHeaderData(
    accessToken: string,
    username: string | null,
    owner: string,
    repo: string,
): Promise<CodebergRepoHeaderInfo | null> {
    const [repoInfo, permission] = await Promise.all([
        getCachedRepo(accessToken, owner, repo),
        getRepoPermissionForUser("codeberg", username, owner, repo),
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

    return {
        hasIssues: repoInfo.has_issues,
        hasWiki: repoInfo.has_wiki,
        hasProjects: repoInfo.has_projects,
        hasDiscussions: false,
        isPrivate: repoInfo.private,
        archived: repoInfo.archived,
        archivedAt: repoInfo.archived_at,
        permissions: { admin: access.admin, write: access.write },
        ownerAvatarUrl: repoInfo.owner.avatar_url,
        allowSquashMerge: repoInfo.allow_squash_merge,
        allowRebaseMerge: repoInfo.allow_rebase,
        allowMergeCommit: repoInfo.allow_merge_commits,
        defaultBranch: repoInfo.default_branch,
        description: repoInfo.description ?? null,
        stars: repoInfo.stars_count,
        forks: repoInfo.forks_count,
        language: repoInfo.language ?? null,
    };
}

export async function getCachedRepoCounts(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<{ openIssuesCount: number; openPullRequestsCount: number }> {
    return withStaleWhileRevalidate(
        repoIssuePullCountsCacheKey("cb", userId, owner, repo),
        () => getRepoCounts(accessToken, owner, repo),
        { staleAfter: 3_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export async function getUserRepos(
    accessToken: string,
): Promise<
    { owner: string; name: string; fullName: string; private: boolean }[]
> {
    const results: {
        owner: string;
        name: string;
        fullName: string;
        private: boolean;
    }[] = [];
    let page = 1;
    // Codeberg caps the effective page size at MAX_RESPONSE_ITEMS (50), so
    // requesting more would make `data.length < limit` break after page 1 and
    // silently drop repos beyond the first 50. See also
    // src/server/sync/codeberg.ts (getReposByOwner / getAuthenticatedUserRepos).
    const limit = 50;

    for (;;) {
        const res = await fetch(
            `${CODEBERG_API}/api/v1/user/repos?limit=${limit}&page=${page}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );
        if (!res.ok) break;
        const data = (await res.json()) as {
            owner: { login: string };
            name: string;
            full_name: string;
            private: boolean;
        }[];
        if (data.length === 0) break;
        for (const r of data) {
            results.push({
                owner: r.owner.login,
                name: r.name,
                fullName: r.full_name,
                private: r.private,
            });
        }
        if (data.length < limit) break;
        page++;
    }

    return results;
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
    const res = await fetch(
        `${CODEBERG_API}/api/v1/user/starred/${owner}/${repo}`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    return res.status === 204;
}

export async function starRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/user/starred/${owner}/${repo}`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) {
        throw new Error(`Failed to star repo: ${res.status} ${res.statusText}`);
    }
}

export async function unstarRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/user/starred/${owner}/${repo}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) {
        console.error("failed to unstar repo", await res.text());
        throw new Error(
            `Failed to unstar repo: ${res.status} ${res.statusText}`,
        );
    }
}

export async function getRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoSubscription | null> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/subscription`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
        subscribed: boolean;
        ignored: boolean;
    };
    return { subscribed: data.subscribed, ignored: data.ignored };
}

export async function setRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
    subscribed: boolean,
    ignored: boolean,
): Promise<void> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/subscription`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ subscribed, ignored }),
        },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to set subscription: ${res.status} ${res.statusText}`,
        );
    }
}

export async function deleteRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const res = await fetch(
        `${CODEBERG_API}/api/v1/repos/${owner}/${repo}/subscription`,
        {
            method: "DELETE",
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to delete subscription: ${res.status} ${res.statusText}`,
        );
    }
}

export async function getCachedRepoStarred(
    accessToken: string,
    owner: string,
    repo: string,
    userId: string,
): Promise<boolean> {
    return withStaleWhileRevalidate(
        repoStarredCacheKey("cb", userId, owner, repo),
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
        repoSubscriptionCacheKey("cb", userId, owner, repo),
        () => getRepoSubscription(accessToken, owner, repo),
        { staleAfter: 30_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}
