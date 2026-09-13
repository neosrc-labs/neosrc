import { TRPCError } from "@trpc/server";
import {
    type CodebergWorkflowRun,
    getBranches,
    listWorkflowRuns,
} from "~/server/codeberg";
import type { ActionsProvider, ActionsRunFilters } from "./provider";
import {
    type ActionsFilterOptions,
    FORGEJO_RUN_STATUS_VALUES,
    isForgejoRunStatus,
    type RepoWorkflowItem,
    WORKFLOW_RUNS_PER_PAGE,
    type WorkflowRunItem,
    type WorkflowRunPage,
} from "./types";

/** Runs sampled for the filter dropdowns. Forgejo caps a page at 50 items. */
const FILTER_SAMPLE_LIMIT = 50;

/**
 * Forgejo stores one status per run, while the display helpers expect the
 * status/conclusion pair GitHub reports. Map each value onto that pair.
 */
const RUN_STATUS: Record<
    string,
    { status: string; conclusion: string | null }
> = {
    unknown: { status: "queued", conclusion: null },
    waiting: { status: "queued", conclusion: null },
    // A blocked run waits for approval: nothing runs until someone acts.
    blocked: { status: "queued", conclusion: "action_required" },
    running: { status: "in_progress", conclusion: null },
    success: { status: "completed", conclusion: "success" },
    failure: { status: "completed", conclusion: "failure" },
    cancelled: { status: "completed", conclusion: "cancelled" },
    skipped: { status: "completed", conclusion: "skipped" },
};

/** Pull request a ref points at. Forgejo refs a pull request run as "#1234". */
function pullRequestNumber(ref: string | null): number | null {
    const match = ref ? /^#(\d+)$/.exec(ref) : null;
    const number = match?.[1];
    return number ? Number.parseInt(number, 10) : null;
}

export function mapCodebergWorkflowRun(
    run: CodebergWorkflowRun,
): WorkflowRunItem {
    const mapped = RUN_STATUS[run.status] ?? {
        // A status Forgejo adds later still renders, as its own label.
        status: run.status,
        conclusion: null,
    };
    const pullRequest = pullRequestNumber(run.prettyRef);

    return {
        id: run.id,
        // The API carries no workflow display name, so the file name stands in.
        name: run.workflowId,
        runNumber: run.indexInRepo,
        displayTitle: run.title || `Run #${run.indexInRepo}`,
        event: run.event,
        status: mapped.status,
        conclusion: mapped.conclusion,
        // A pull request ref is not a branch; the row shows it as a PR instead.
        branch: pullRequest === null ? run.prettyRef : null,
        actor: run.actor,
        pullRequestNumber: pullRequest,
        createdAt: run.createdAt,
        runStartedAt: run.runStartedAt,
        updatedAt: run.updatedAt,
        htmlUrl: run.htmlUrl,
    };
}

/** Codeberg implementation, backed by the Forgejo client in ~/server/codeberg. */
export class CodebergActionsProvider implements ActionsProvider {
    constructor(
        private readonly accessToken: string,
        private readonly owner: string,
        private readonly repo: string,
    ) {}

    async listWorkflowRuns(
        filters: ActionsRunFilters,
    ): Promise<WorkflowRunPage> {
        const page = filters.page;
        const { runs, totalCount } = await listWorkflowRuns(
            this.accessToken,
            this.owner,
            this.repo,
            {
                page,
                limit: WORKFLOW_RUNS_PER_PAGE,
                event: filters.event,
                status: forgejoStatus(filters.status),
                // Forgejo filters by full ref, not by branch name.
                ref: filters.branch
                    ? `refs/heads/${filters.branch}`
                    : undefined,
                workflowId: filters.workflow,
            },
        );

        return {
            items: runs.map(mapCodebergWorkflowRun),
            totalCount,
            hasNextPage: page * WORKFLOW_RUNS_PER_PAGE < totalCount,
        };
    }

    async listWorkflows(): Promise<RepoWorkflowItem[]> {
        // Forgejo exposes no workflow catalogue, so the sidebar lists the
        // workflow files the most recent runs came from.
        const { runs } = await this.sampleRuns();
        const ids = new Set(
            runs.map((run) => run.workflowId).filter((id) => id !== ""),
        );
        return [...ids]
            .sort((a, b) => a.localeCompare(b))
            .map((id) => ({ id, name: id }));
    }

    async listFilterOptions(): Promise<ActionsFilterOptions> {
        const [branches, { runs }] = await Promise.all([
            getBranches(this.accessToken, this.owner, this.repo),
            this.sampleRuns(),
        ]);
        const events = new Set(runs.map((run) => run.event));

        return {
            branches: branches.map((branch) => branch.name),
            // Forgejo cannot filter runs by actor, so the toolbar omits it.
            actors: [],
            events: [...events].sort((a, b) => a.localeCompare(b)),
            statuses: [...FORGEJO_RUN_STATUS_VALUES],
        };
    }

    private sampleRuns() {
        return listWorkflowRuns(this.accessToken, this.owner, this.repo, {
            page: 1,
            limit: FILTER_SAMPLE_LIMIT,
        });
    }
}

/**
 * The input schema accepts every provider's status values, so reject one
 * Forgejo does not know rather than letting the API answer with a 400.
 */
function forgejoStatus(status: string | undefined): string | undefined {
    if (!status) return undefined;
    if (!isForgejoRunStatus(status)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Forgejo cannot filter workflow runs by status "${status}"`,
        });
    }
    return status;
}
