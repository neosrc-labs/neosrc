import type { RestEndpointMethodTypes } from "@octokit/rest";
import type {
    ActionsFilterOptions,
    GithubRunStatus,
    RepoWorkflowItem,
    WorkflowRunActor,
    WorkflowRunItem,
    WorkflowRunPage,
} from "~/server/api/routers/actions/types";
import {
    GITHUB_RUN_STATUS_VALUES,
    WORKFLOW_RUNS_PER_PAGE,
} from "~/server/api/routers/actions/types";
import { createOctokit } from "./client";

type WorkflowRun =
    RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["response"]["data"]["workflow_runs"][number];

type ActorData = NonNullable<WorkflowRun["actor"]>;

function mapActor(actor: ActorData): WorkflowRunActor {
    return {
        login: actor.login,
        avatarUrl: actor.avatar_url,
        url: actor.html_url,
    };
}

export interface ListWorkflowRunsParams {
    workflowId?: string;
    branch?: string;
    actor?: string;
    event?: string;
    status?: GithubRunStatus;
    page?: number;
}

function mapWorkflowRun(run: WorkflowRun): WorkflowRunItem {
    return {
        id: run.id,
        name: run.name ?? "",
        runNumber: run.run_number,
        displayTitle: run.display_title ?? run.name ?? `Run #${run.run_number}`,
        event: run.event,
        status: run.status ?? "",
        conclusion: run.conclusion,
        branch: run.head_branch ?? null,
        actor: run.actor ? mapActor(run.actor) : null,
        pullRequestNumber: run.pull_requests?.[0]?.number ?? null,
        createdAt: run.created_at,
        runStartedAt: run.run_started_at ?? null,
        updatedAt: run.updated_at,
        htmlUrl: run.html_url,
    };
}

export async function listWorkflowRuns(
    accessToken: string,
    owner: string,
    repo: string,
    params: ListWorkflowRunsParams,
): Promise<WorkflowRunPage> {
    const octokit = createOctokit(accessToken);
    const page = params.page ?? 1;

    const common = {
        owner,
        repo,
        per_page: WORKFLOW_RUNS_PER_PAGE,
        page,
        branch: params.branch,
        actor: params.actor,
        event: params.event,
        status: params.status,
    };

    // The repo-wide endpoint has no workflow parameter, so a workflow filter
    // must go through the per-workflow endpoint.
    const { data } = params.workflowId
        ? await octokit.rest.actions.listWorkflowRuns({
              ...common,
              workflow_id: params.workflowId,
          })
        : await octokit.rest.actions.listWorkflowRunsForRepo(common);

    return {
        items: data.workflow_runs.map(mapWorkflowRun),
        totalCount: data.total_count,
        hasNextPage: page * WORKFLOW_RUNS_PER_PAGE < data.total_count,
    };
}

export async function listRepoWorkflows(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoWorkflowItem[]> {
    const octokit = createOctokit(accessToken);
    const workflows = await octokit.paginate(
        octokit.rest.actions.listRepoWorkflows,
        { owner, repo, per_page: 100 },
    );

    return workflows.map((workflow) => ({
        id: String(workflow.id),
        name: workflow.name,
    }));
}

/**
 * Filter option catalogue for the toolbar. The REST API exposes no actor or
 * event listing, so both are derived from the most recent page of runs: a
 * branch or actor without recent activity will not appear as an option.
 */
export async function listWorkflowRunFilterOptions(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<ActionsFilterOptions> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 100,
        page: 1,
    });

    const branches = new Set<string>();
    const events = new Set<string>();
    const actors = new Map<string, WorkflowRunActor>();

    for (const run of data.workflow_runs) {
        if (run.head_branch) branches.add(run.head_branch);
        events.add(run.event);
        if (run.actor) actors.set(run.actor.login, mapActor(run.actor));
    }

    return {
        branches: [...branches].sort((a, b) => a.localeCompare(b)),
        events: [...events].sort((a, b) => a.localeCompare(b)),
        actors: [...actors.values()].sort((a, b) =>
            a.login.localeCompare(b.login),
        ),
        statuses: [...GITHUB_RUN_STATUS_VALUES],
    };
}
