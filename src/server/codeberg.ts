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

type CodebergPrListParams = {
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
};

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

        const items = (await res.json()) as CodebergPullRequest[];

        const linkHeader = res.headers.get("Link");
        const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

        return { items, totalCount: items.length, hasNextPage };
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
