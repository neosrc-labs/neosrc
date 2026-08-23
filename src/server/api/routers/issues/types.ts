import type { Assignee, Author, Label } from "../mappers";

export interface IssueSearchItem {
    number: number;
    title: string;
    state: "OPEN" | "CLOSED";
    createdAt: string;
    closedAt: string | null;
    author: Author | null;
    labels: Label[];
    assignees: Assignee[];
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
