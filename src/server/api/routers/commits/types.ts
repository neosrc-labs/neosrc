import type { StatusContext } from "~/components/ci-status";

export interface CommitListItem {
    sha: string;
    shortSha: string;
    message: string;
    committedDate: string; // ISO 8601
    author: {
        login: string;
        avatarUrl: string;
    } | null;
    committerName: string | null; // fallback display name when author is null
    statusState: string | null; // "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | null
    statusContexts: StatusContext[];
    signature: {
        __typename: string;
        isValid: boolean | null;
        state?: string;
        keyId?: string;
    } | null;
}

export interface ListCommitsParams {
    provider: "gh" | "cb";
    owner: string;
    repo: string;
    branch: string;
    page: number;
    perPage: number;
    author?: string;
}

export interface ListCommitsResult {
    commits: CommitListItem[];
    totalCount: number;
    cursors: { start: string; end: string } | null;
}
