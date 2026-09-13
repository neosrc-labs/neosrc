import { z } from "zod";
import {
    createTRPCRouter,
    providerInput,
    providerQuery,
} from "~/server/api/trpc";
import { CodebergActionsProvider } from "./codeberg";
import { GitHubActionsProvider } from "./github";
import type { ActionsProvider } from "./provider";
import { WORKFLOW_RUN_STATUS_VALUES } from "./types";

type ProviderFactory = (
    accessToken: string,
    owner: string,
    repo: string,
) => ActionsProvider;

/** Provider implementations. A new provider is one entry here plus its
 * `ACTIONS_CAPABILITIES` entry. */
const providers = {
    gh: (accessToken, owner, repo) =>
        new GitHubActionsProvider(accessToken, owner, repo),
    cb: (accessToken, owner, repo) =>
        new CodebergActionsProvider(accessToken, owner, repo),
} satisfies Record<"gh" | "cb", ProviderFactory>;

const runFilters = {
    owner: z.string(),
    repo: z.string(),
    workflow: z.string().optional(),
    branch: z.string().optional(),
    actor: z.string().optional(),
    event: z.string().optional(),
    // Every provider's status vocabulary. A provider rejects values it does
    // not accept.
    status: z.enum(WORKFLOW_RUN_STATUS_VALUES).optional(),
    page: z.number().int().min(1).default(1),
};

const repoParams = {
    owner: z.string(),
    repo: z.string(),
};

export const actionsRouter = createTRPCRouter({
    listWorkflowRuns: providerQuery({
        input: providerInput(runFilters),
        gh: ({ accessToken, input }) =>
            providers
                .gh(accessToken, input.owner, input.repo)
                .listWorkflowRuns(input),
        cb: ({ accessToken, input }) =>
            providers
                .cb(accessToken, input.owner, input.repo)
                .listWorkflowRuns(input),
    }),

    listWorkflows: providerQuery({
        input: providerInput(repoParams),
        gh: ({ accessToken, input }) =>
            providers.gh(accessToken, input.owner, input.repo).listWorkflows(),
        cb: ({ accessToken, input }) =>
            providers.cb(accessToken, input.owner, input.repo).listWorkflows(),
    }),

    getFilterOptions: providerQuery({
        input: providerInput(repoParams),
        gh: ({ accessToken, input }) =>
            providers
                .gh(accessToken, input.owner, input.repo)
                .listFilterOptions(),
        cb: ({ accessToken, input }) =>
            providers
                .cb(accessToken, input.owner, input.repo)
                .listFilterOptions(),
    }),
});
