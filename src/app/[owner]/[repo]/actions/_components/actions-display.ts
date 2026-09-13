import { formatDurationMs } from "~/components/hovercards/hover-card-shared";
import type {
    WorkflowRunItem,
    WorkflowRunStatus,
} from "~/server/api/routers/actions/types";
import { WORKFLOW_RUN_STATUS_VALUES } from "~/server/api/routers/actions/types";

const STATUS_LABELS: Record<WorkflowRunStatus, string> = {
    in_progress: "In progress",
    queued: "Queued",
    requested: "Requested",
    waiting: "Waiting",
    pending: "Pending",
    completed: "Completed",
    success: "Success",
    failure: "Failure",
    action_required: "Action required",
    cancelled: "Cancelled",
    skipped: "Skipped",
    neutral: "Neutral",
    stale: "Stale",
    timed_out: "Timed out",
};

export const WORKFLOW_RUN_STATUS_OPTIONS: readonly {
    value: WorkflowRunStatus;
    label: string;
}[] = WORKFLOW_RUN_STATUS_VALUES.map((value) => ({
    value,
    label: STATUS_LABELS[value],
}));

// Keyed by plain string so a raw API status can be looked up without a cast.
const STATUS_LABEL_BY_VALUE = new Map<string, string>(
    WORKFLOW_RUN_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

const EVENT_LABELS: Record<string, string> = {
    push: "Push",
    pull_request: "Pull request",
    pull_request_target: "Pull request target",
    schedule: "Schedule",
    workflow_dispatch: "Manual",
    repository_dispatch: "Repository dispatch",
    release: "Release",
    issues: "Issues",
    issue_comment: "Issue comment",
    merge_group: "Merge group",
    create: "Create",
    delete: "Delete",
    deployment: "Deployment",
    check_run: "Check run",
    check_suite: "Check suite",
    discussion: "Discussion",
    fork: "Fork",
    page_build: "Page build",
    public: "Public",
    status: "Status",
    watch: "Watch",
};

export function eventLabel(event: string): string {
    return EVENT_LABELS[event] ?? event.replace(/_/g, " ");
}

/**
 * Trailing label for a run row. A finished run shows nothing here and falls
 * back to its duration; anything that needs attention shows a status label.
 */
export function runStatusLabel(
    status: string,
    conclusion: string | null,
): string | null {
    if (status === "completed") {
        const label =
            !conclusion || conclusion === "success"
                ? null
                : STATUS_LABEL_BY_VALUE.get(conclusion);
        return label ?? null;
    }
    return STATUS_LABEL_BY_VALUE.get(status) ?? null;
}

export function runDurationLabel(run: WorkflowRunItem): string | null {
    if (run.status !== "completed" || !run.runStartedAt) return null;
    const start = new Date(run.runStartedAt).getTime();
    const end = new Date(run.updatedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return formatDurationMs(end - start);
}

// Events whose runs belong to a pull request. GitHub reports associated pull
// requests for other events too (a push to main lists pull requests targeting
// main), which would read as if the run belonged to them.
const PULL_REQUEST_EVENTS = new Set(["pull_request", "pull_request_target"]);

/** Pull request a run belongs to, or null when the run is not PR-triggered. */
export function runPullRequestNumber(run: WorkflowRunItem): number | null {
    return PULL_REQUEST_EVENTS.has(run.event) ? run.pullRequestNumber : null;
}
