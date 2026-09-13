import type {
    ActionsFilterOptions,
    RepoWorkflowItem,
    WorkflowRunPage,
} from "./types";

/** Run filters a page can carry. Providers apply the ones they support. */
export interface ActionsRunFilters {
    workflow?: string;
    branch?: string;
    actor?: string;
    event?: string;
    status?: string;
    page: number;
}

/**
 * Repository data the Actions pages read: one implementation per provider
 * (github.ts, codeberg.ts), each constructing with `(accessToken, owner, repo)`.
 *
 * Adding a provider means implementing this interface, extending
 * `ACTIONS_CAPABILITIES` in types.ts with the filters it can honour, and adding
 * its branch to the router. Components only see the types in types.ts.
 */
export interface ActionsProvider {
    listWorkflowRuns(filters: ActionsRunFilters): Promise<WorkflowRunPage>;
    /** Workflows the repository defines, for the sidebar and Workflow filter. */
    listWorkflows(): Promise<RepoWorkflowItem[]>;
    /** Values for the toolbar's filter dropdowns. */
    listFilterOptions(): Promise<ActionsFilterOptions>;
}
