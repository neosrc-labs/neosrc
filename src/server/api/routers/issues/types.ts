import type {
    SearchAssignee,
    SearchAuthor,
    SearchLabel,
} from "~/server/api/routers/search-shared";

export interface IssueSearchItem {
    number: number;
    title: string;
    state: "OPEN" | "CLOSED";
    createdAt: string;
    closedAt: string | null;
    author: SearchAuthor | null;
    labels: SearchLabel[];
    assignees: SearchAssignee[];
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
