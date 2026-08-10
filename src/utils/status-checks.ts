import type { CheckRun } from "~/server/github";

export interface CommitStatus {
    state: string;
    target_url: string | null;
    description: string | null;
    context: string;
    created_at: string;
    updated_at: string;
    creator: {
        login: string;
        avatar_url: string;
        html_url: string;
    } | null;
}

export function mapStatusToCheckRun(status: CommitStatus): CheckRun {
    const isPending = status.state === "pending";
    return {
        name: status.context,
        conclusion: isPending
            ? null
            : status.state === "error"
              ? "failure"
              : status.state,
        status: isPending ? "in_progress" : "completed",
        description: status.description,
        html_url: status.target_url ?? undefined,
        details_url: null,
        started_at: status.created_at,
        completed_at: isPending ? null : status.updated_at,
        app: null,
        creator: status.creator,
    };
}

export function deduplicateCommitStatuses(statuses: CommitStatus[]) {
    const latest = new Map<string, CommitStatus>();
    for (const status of statuses) {
        const existing = latest.get(status.context);
        if (!existing || status.updated_at >= existing.updated_at) {
            latest.set(status.context, status);
        }
    }
    return [...latest.values()];
}
