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

export type IssueAuthor = {
    login: string;
    avatarUrl: string;
    profileUrl: string;
};

/** `id` is the provider-local identifier its write API expects: GitHub uses
 *  the issue milestone number, Codeberg the milestone id. */
export type IssueMilestone = { id: string; title: string; htmlUrl: string };

export interface IssueDetail {
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    /** Codeberg has no issue lock; always false there. */
    locked: boolean;
    comments: number;
    createdAt: string;
    author: IssueAuthor | null;
    /** GitHub author_association (MEMBER/OWNER/...); null where the provider
     *  has no equivalent. */
    authorAssociation: string | null;
    labels: Label[];
    assignees: Assignee[];
    milestone: IssueMilestone | null;
}

/** The slice the metadata sidebar consumes; IssueDetail satisfies it structurally. */
export interface IssueMetadata {
    labels: Label[];
    assignees: Assignee[];
    milestone: IssueMilestone | null;
}
