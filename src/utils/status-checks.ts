import type { CheckRun, GhCheckRun } from "~/server/github";

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

export function mapGitHubCheckRunToCheckRun(check: GhCheckRun): CheckRun {
    return {
        name: check.name,
        conclusion: check.conclusion,
        status: check.status,
        description: check.output.title ?? check.output.summary,
        html_url: check.html_url ?? undefined,
        details_url: check.details_url,
        started_at: check.started_at,
        completed_at: check.completed_at,
        app: check.app
            ? {
                  name: check.app.name,
                  owner: check.app.owner
                      ? {
                            avatar_url: check.app.owner.avatar_url,
                        }
                      : null,
              }
            : null,
    };
}
