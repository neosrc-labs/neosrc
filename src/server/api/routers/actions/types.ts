// Provider-neutral workflow run contract. Kept free of server imports so the
// client can import these types and constants directly.
import type { Provider } from "~/utils/provider-url";

export const WORKFLOW_RUNS_PER_PAGE = 30;

// Status values the GitHub runs API accepts as its `status` filter.
export const GITHUB_RUN_STATUS_VALUES = [
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

// Values Forgejo stores for a run. A Forgejo run carries one status rather than
// a status/conclusion pair, and its API accepts these names as the filter.
export const FORGEJO_RUN_STATUS_VALUES = [
    "unknown",
    "waiting",
    "running",
    "success",
    "failure",
    "cancelled",
    "skipped",
    "blocked",
] as const;

// Both vocabularies. The router schema validates against this union, which
// keeps a hand-typed status from reaching a provider that would reject it.
export const WORKFLOW_RUN_STATUS_VALUES = [
    ...GITHUB_RUN_STATUS_VALUES,
    "running",
    "blocked",
    "unknown",
] as const;

export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUS_VALUES)[number];

/** Status values the GitHub runs API accepts. */
export type GithubRunStatus = (typeof GITHUB_RUN_STATUS_VALUES)[number];

/** Status values Forgejo reports for a run. */
export type ForgejoRunStatus = (typeof FORGEJO_RUN_STATUS_VALUES)[number];

export function isWorkflowRunStatus(value: string): value is WorkflowRunStatus {
    return (WORKFLOW_RUN_STATUS_VALUES as readonly string[]).includes(value);
}

/** Whether GitHub's runs API accepts this value as its `status` filter. */
export function isGithubRunStatus(value: string): value is GithubRunStatus {
    return (GITHUB_RUN_STATUS_VALUES as readonly string[]).includes(value);
}

/** Whether Forgejo reports this value for a run. */
export function isForgejoRunStatus(value: string): value is ForgejoRunStatus {
    return (FORGEJO_RUN_STATUS_VALUES as readonly string[]).includes(value);
}

export interface WorkflowRunActor {
    login: string;
    avatarUrl: string;
    url?: string;
}

export interface WorkflowRunItem {
    id: number;
    /** Workflow the run belongs to: its display name, or its file name when the
     * provider exposes no name. */
    name: string;
    runNumber: number;
    displayTitle: string;
    event: string;
    /** Normalized to the vocabulary the display helpers know. */
    status: string;
    conclusion: string | null;
    branch: string | null;
    actor: WorkflowRunActor | null;
    /**
     * Pull request the provider associates with the run, or the one parsed from
     * a pull request ref. Providers also report unrelated pull requests (GitHub
     * matches on the run's branch), so gate on the event before showing this.
     */
    pullRequestNumber: number | null;
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

/** A workflow a repository defines. `id` is what the `workflow` filter carries. */
export interface RepoWorkflowItem {
    id: string;
    name: string;
}

export interface ActionsFilterOptions {
    branches: string[];
    actors: WorkflowRunActor[];
    events: string[];
    statuses: WorkflowRunStatus[];
}

/** Filter dropdowns on the Actions page. */
export type ActionsFilterKey =
    | "workflow"
    | "event"
    | "status"
    | "branch"
    | "actor";

export interface ActionsCapabilities {
    /** Filters the provider applies server-side. The toolbar renders these and
     * the page drops the others, so a provider never offers a control it
     * cannot honour. */
    filters: readonly ActionsFilterKey[];
    /** The provider's own site has Caches and Deployments pages to link to. */
    managementLinks: boolean;
}

export const ACTIONS_CAPABILITIES: Record<Provider, ActionsCapabilities> = {
    gh: {
        filters: ["workflow", "event", "status", "branch", "actor"],
        managementLinks: true,
    },
    // Forgejo's runs API has no actor filter.
    cb: {
        filters: ["workflow", "event", "status", "branch"],
        managementLinks: false,
    },
};
