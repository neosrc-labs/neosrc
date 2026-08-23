import type { Assignee, Author, Label } from "../mappers";

export interface PrSearchItem {
    id: number;
    number: number;
    title: string;
    state: "OPEN" | "CLOSED" | "MERGED";
    isDraft: boolean;
    createdAt: string;
    mergedAt: string | null;
    author: Author | null;
    labels: Label[];
    assignees: Assignee[];
    comments: number;
    reviewDecision: string | null;
    mergeable?: string;
    stack: { size: number; position: number; number: number } | null;
}

export interface PrSearchResult {
    items: PrSearchItem[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    stateCounts: {
        open: number;
        closed: number;
        merged: number;
    };
}
