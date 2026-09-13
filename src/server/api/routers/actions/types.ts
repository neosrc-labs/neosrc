// Provider-neutral workflow run contract. Kept free of server imports so the
// client can import these types and constants directly.
export const WORKFLOW_RUNS_PER_PAGE = 30;

// Every status the runs endpoints accept. Shared so the filter dropdown and
// the request layer cannot drift apart.
export const WORKFLOW_RUN_STATUS_VALUES = [
    "in_progress",
    "queued",
    "requested",
    "waiting",
    "pending",
    "completed",
    "success",
    "failure",
    "action_required",
    "cancelled",
    "skipped",
    "neutral",
    "stale",
    "timed_out",
] as const;

export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUS_VALUES)[number];

export function isWorkflowRunStatus(value: string): value is WorkflowRunStatus {
    return (WORKFLOW_RUN_STATUS_VALUES as readonly string[]).includes(value);
}

export interface WorkflowRunActor {
    login: string;
    avatarUrl: string;
}

export interface WorkflowRunItem {
    id: number;
    name: string;
    runNumber: number;
    displayTitle: string;
    event: string;
    status: string;
    conclusion: string | null;
    branch: string | null;
    actor: WorkflowRunActor | null;
    createdAt: string;
    runStartedAt: string | null;
    updatedAt: string;
    htmlUrl: string;
}

export interface WorkflowRunPage {
    items: WorkflowRunItem[];
    totalCount: number;
    hasNextPage: boolean;
}

export interface RepoWorkflowItem {
    id: number;
    name: string;
    path: string;
    state: string;
}

export interface ActionsFilterOptions {
    branches: string[];
    actors: WorkflowRunActor[];
    events: string[];
}
