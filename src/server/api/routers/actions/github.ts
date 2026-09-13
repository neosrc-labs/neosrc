import { TRPCError } from "@trpc/server";
import {
    listRepoWorkflows,
    listWorkflowRunFilterOptions,
    listWorkflowRuns,
} from "~/server/github";
import type { ActionsProvider, ActionsRunFilters } from "./provider";
import {
    type ActionsFilterOptions,
    type GithubRunStatus,
    isGithubRunStatus,
    type RepoWorkflowItem,
    type WorkflowRunPage,
} from "./types";

/** GitHub implementation, backed by the Octokit wrappers in ~/server/github. */
export class GitHubActionsProvider implements ActionsProvider {
    constructor(
        private readonly accessToken: string,
        private readonly owner: string,
        private readonly repo: string,
    ) {}

    listWorkflowRuns(filters: ActionsRunFilters): Promise<WorkflowRunPage> {
        return listWorkflowRuns(this.accessToken, this.owner, this.repo, {
            workflowId: filters.workflow,
            branch: filters.branch,
            actor: filters.actor,
            event: filters.event,
            status: githubStatus(filters.status),
            page: filters.page,
        });
    }

    listWorkflows(): Promise<RepoWorkflowItem[]> {
        return listRepoWorkflows(this.accessToken, this.owner, this.repo);
    }

    listFilterOptions(): Promise<ActionsFilterOptions> {
        return listWorkflowRunFilterOptions(
            this.accessToken,
            this.owner,
            this.repo,
        );
    }
}

/**
 * The input schema accepts every provider's status values, so reject one GitHub
 * does not know rather than letting the API answer with a 422.
 */
function githubStatus(status: string | undefined): GithubRunStatus | undefined {
    if (!status) return undefined;
    if (!isGithubRunStatus(status)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `GitHub cannot filter workflow runs by status "${status}"`,
        });
    }
    return status;
}
