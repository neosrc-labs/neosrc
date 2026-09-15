import type { StatusContext } from "~/components/ci-status";

export type BranchTab = "overview" | "active" | "stale" | "all";

export interface BranchAuthor {
    login: string | null;
    name: string;
    avatarUrl: string | null;
}

export interface BranchRow {
    name: string;
    sha: string;
    /** ISO timestamp of the branch head commit. */
    updatedAt: string;
    author: BranchAuthor | null;
    isProtected: boolean;
    pullRequestNumber: number | null;
    checks: StatusContext[];
}

export interface BranchListResult {
    items: BranchRow[];
    /** Rows matching the tab + query (after the provider's reachable bound). */
    totalCount: number;
    hasNextPage: boolean;
    defaultBranch: string | null;
    /** Overview only: the pinned default-branch row. */
    defaultBranchRow: BranchRow | null;
}
