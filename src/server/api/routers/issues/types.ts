export interface IssueSearchItem {
    number: number;
    title: string;
    state: "OPEN" | "CLOSED";
    createdAt: string;
    closedAt: string | null;
    author: { login: string; avatarUrl: string; url: string } | null;
    labels: Array<{
        id: string;
        name: string;
        color: string;
        description: string | null;
    }>;
    assignees: Array<{ login: string; avatarUrl: string }>;
    comments: number;
}

export interface IssueSearchResult {
    items: IssueSearchItem[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    stateCounts: {
        open: number;
        closed: number;
    };
}

export interface SearchParams {
    owner: string;
    repo: string;
    query: string;
    page?: number;
    after?: string;
    first?: number;
    sort?: "created" | "updated" | "comments";
    order?: "asc" | "desc";
}
