import { z } from "zod";
import {
    createTRPCRouter,
    providerInput,
    providerQuery,
} from "~/server/api/trpc";
import {
    listRepoWorkflows,
    listWorkflowRunFilterOptions,
    listWorkflowRuns,
} from "~/server/github";
import {
    type ActionsFilterOptions,
    WORKFLOW_RUN_STATUS_VALUES,
    type WorkflowRunPage,
} from "./types";

const EMPTY_RUN_PAGE: WorkflowRunPage = {
    items: [],
    totalCount: 0,
    hasNextPage: false,
};

const EMPTY_FILTER_OPTIONS: ActionsFilterOptions = {
    branches: [],
    actors: [],
    events: [],
};

export const actionsRouter = createTRPCRouter({
    listWorkflowRuns: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
            workflow: z.string().optional(),
            branch: z.string().optional(),
            actor: z.string().optional(),
            event: z.string().optional(),
            status: z.enum(WORKFLOW_RUN_STATUS_VALUES).optional(),
            page: z.number().int().min(1).default(1),
        }),
        cbFallback: (): WorkflowRunPage => EMPTY_RUN_PAGE,
        gh: ({ accessToken, input }) =>
            listWorkflowRuns(accessToken, input.owner, input.repo, {
                workflowId: input.workflow,
                branch: input.branch,
                actor: input.actor,
                event: input.event,
                status: input.status,
                page: input.page,
            }),
    }),

    listWorkflows: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cbFallback: () => [],
        gh: ({ accessToken, input }) =>
            listRepoWorkflows(accessToken, input.owner, input.repo),
    }),

    getFilterOptions: providerQuery({
        input: providerInput({
            owner: z.string(),
            repo: z.string(),
        }),
        cbFallback: (): ActionsFilterOptions => EMPTY_FILTER_OPTIONS,
        gh: ({ accessToken, input }) =>
            listWorkflowRunFilterOptions(accessToken, input.owner, input.repo),
    }),
});
