import type { StatusContext } from "~/components/ci-status";
import type { GQLGitSignatureSummary } from "~/server/github-graphql";

export interface CommitListItem {
    sha: string;
    shortSha: string;
    message: string;
    committedDate: string; // ISO 8601
    author: {
        login: string;
        avatarUrl: string;
        url: string;
    } | null;
    committerName: string | null; // fallback display name when author is null
    statusState: string | null; // "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | null
    statusContexts: StatusContext[];
    signature: GQLGitSignatureSummary | null;
}

export interface ListCommitsResult {
    commits: CommitListItem[];
    totalCount: number;
    cursors: { start: string; end: string } | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}
