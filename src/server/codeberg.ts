import { cache } from "react";

const CODEBERG_API = "https://codeberg.org";

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

function parseTotalCountFromLinkHeader(
    linkHeader: string | null,
    limit: number,
    currentCount: number,
    page: number,
): number {
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
        // There are more pages beyond current; estimate total
        return (maxPage - 1) * limit + currentCount;
    }

    return currentCount;
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
            limit,
            items.length,
            page,
        );

        return { items, totalCount, hasNextPage };
    },
);

export const getUser = cache(async (accessToken: string) => {
    const res = await fetch(`${CODEBERG_API}/api/v1/user`, {
        headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/json",
        },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CodebergUser>;
});

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
) => {
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
    return res.json() as Promise<CodebergLabel[]>;
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
    async (accessToken: string, owner: string, repo: string) => {
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
        return res.json() as Promise<CodebergMilestone[]>;
    },
);

export type CodebergAssignee = {
    id: number;
    login: string;
    avatar_url: string;
};

export const listAssignees = cache(
    async (accessToken: string, owner: string, repo: string) => {
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
        return res.json() as Promise<CodebergAssignee[]>;
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
    async (accessToken: string, username: string) => {
        const res = await fetch(`${CODEBERG_API}/api/v1/users/${username}`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/json",
            },
        });
        if (!res.ok) return null;
        return res.json() as Promise<CodebergUserByUsername>;
    },
);

export type CodebergRepo = {
    id: number;
    owner: { login: string; avatar_url: string };
    name: string;
    full_name: string;
    private: boolean;
    has_issues: boolean;
    has_wiki: boolean;
    has_projects: boolean;
    permissions: { admin: boolean; push: boolean; pull: boolean };
};

export const getRepo = cache(
    async (accessToken: string, owner: string, repo: string) => {
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
        return res.json() as Promise<CodebergRepo>;
    },
);

export const getRepoCounts = cache(
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

export type CodebergIssueListParams = {
    state?: "open" | "closed" | "all";
    sort?: CodebergIssueSort;
    page?: number;
    limit?: number;
    author?: string;
    labels?: string[];
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

        const limit = params.limit ?? 30;

        const linkHeader = res.headers.get("Link");
        const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

        const page = params.page ?? 1;
        const totalCount = parseTotalCountFromLinkHeader(
            linkHeader,
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
        if (!res.ok) return null;
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
