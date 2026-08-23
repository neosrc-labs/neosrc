import type { CodebergPullRequestSort } from "~/server/codeberg";
import type { SearchParams } from "./provider";

// Forgejo uses one sort vocabulary for both issues and pull requests.
export type ForgejoSort = CodebergPullRequestSort;

const SORT_MAP: Record<string, ForgejoSort | undefined> = {
    "created-desc": "newest",
    "created-asc": "oldest",
    "updated-desc": "recentupdate",
    "updated-asc": "leastupdate",
    "comments-desc": "mostcomment",
    "comments-asc": "leastcomment",
};

export function resolveForgejoSort(
    params: Pick<SearchParams, "sort" | "order">,
): ForgejoSort {
    const key =
        params.sort && params.order
            ? `${params.sort}-${params.order}`
            : "created-desc";
    return SORT_MAP[key] ?? "newest";
}

export type ForgejoQueryQualifiers = {
    activeState: "open" | "closed" | "merged";
    author?: string;
    labels: string[];
};

// Pulls accept is:merged as a state qualifier; issues do not.
export function parseForgejoQuery(
    query: string,
    options: { allowMerged: boolean },
): ForgejoQueryQualifiers {
    const statePattern = options.allowMerged
        ? /^(is:open|is:closed|is:merged)\s*/
        : /^(is:open|is:closed)\s*/;
    const activeState = (query.match(statePattern)?.[1]?.replace("is:", "") ??
        "open") as ForgejoQueryQualifiers["activeState"];

    const authorMatch = query.match(/author:(\S+)/);

    const labels: string[] = [];
    for (const match of query.matchAll(/label:\s*("[^"]*"|\S+)/g)) {
        const name = (match[1] ?? "").replace(/^"|"$/g, "");
        if (name) labels.push(name);
    }

    return {
        activeState,
        author: authorMatch?.[1],
        labels,
    };
}

type ForgejoListFn = (
    accessToken: string,
    owner: string,
    repo: string,
    params: {
        state: "open" | "closed";
        sort: ForgejoSort;
        limit: number;
        page: number;
    },
) => Promise<{ totalCount: number }>;

export async function forgejoStateCounts(
    list: ForgejoListFn,
    accessToken: string,
    owner: string,
    repo: string,
    sort: ForgejoSort,
): Promise<{ open: number; closed: number }> {
    const countParams = { sort, limit: 1, page: 1 };
    const [open, closed] = await Promise.all([
        list(accessToken, owner, repo, { ...countParams, state: "open" }),
        list(accessToken, owner, repo, { ...countParams, state: "closed" }),
    ]);
    return { open: open.totalCount, closed: closed.totalCount };
}
