import type {
    CodebergPullRequestSort,
    MetadataPresence,
    PresenceFilter,
} from "~/server/codeberg";
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
    presence: MetadataPresence;
};

// Pulls accept is:merged as a state qualifier; issues do not.
export function parseForgejoQuery(
    query: string,
    options: { allowMerged: boolean },
): ForgejoQueryQualifiers {
    // State tokens are valid at any position of a Forgejo query, so match at
    // token boundaries anywhere rather than only at the start.
    const statePattern = options.allowMerged
        ? /(?<=^|\s)(is:open|is:closed|is:merged)(?=\s|$)/
        : /(?<=^|\s)(is:open|is:closed)(?=\s|$)/;
    const activeState = (query.match(statePattern)?.[1]?.replace("is:", "") ??
        "open") as ForgejoQueryQualifiers["activeState"];

    const authorMatch = query.match(/author:(\S+)/);

    const labels: string[] = [];
    for (const match of query.matchAll(/label:\s*("[^"]*"|\S+)/g)) {
        const name = (match[1] ?? "").replace(/^"|"$/g, "");
        if (name) labels.push(name);
    }

    // Rightmost modifier wins when a field is repeated, matching the state
    // rules. Only the metadata the issue list exposes is modelled.
    const presence: MetadataPresence = {};
    for (const match of query.matchAll(
        /(?<=^|\s)(has|no):(assignee|label|milestone)(?=\s|$)/g,
    )) {
        presence[match[2] as keyof MetadataPresence] =
            match[1] as PresenceFilter;
    }

    return {
        activeState,
        author: authorMatch?.[1],
        labels,
        presence,
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
        author?: string;
        labels?: string[];
        presence?: MetadataPresence;
    },
) => Promise<{ totalCount: number }>;

export async function forgejoStateCounts(
    list: ForgejoListFn,
    accessToken: string,
    owner: string,
    repo: string,
    sort: ForgejoSort,
    filters: {
        author?: string;
        labels?: string[];
        presence?: MetadataPresence;
    } = {},
): Promise<{ open: number; closed: number }> {
    const countParams = { sort, limit: 1, page: 1, ...filters };
    const [open, closed] = await Promise.all([
        list(accessToken, owner, repo, { ...countParams, state: "open" }),
        list(accessToken, owner, repo, { ...countParams, state: "closed" }),
    ]);
    return { open: open.totalCount, closed: closed.totalCount };
}
