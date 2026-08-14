import { z } from "zod";
import {
    getProviderToken,
    providerTargetInput,
    searchParamsInput,
} from "~/server/api/routers/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
    getIssue as getCodebergIssue,
    searchIssues as searchCodebergIssues,
} from "~/server/codeberg";
import { getIssue as getGitHubIssue, searchIssues } from "~/server/github";
import { CodebergIssueProvider } from "./codeberg";
import { GitHubIssueProvider } from "./github";
import type { IssueProvider } from "./provider";
import type { IssueSearchResult } from "./types";

export const issuesRouter = createTRPCRouter({
    getByNumber: protectedProcedure
        .input(providerTargetInput.extend({ issueNumber: z.number() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);

            if (input.provider === "cb") {
                return getCodebergIssue(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.issueNumber,
                );
            }
            return getGitHubIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
            );
        }),

    search: protectedProcedure
        .input(searchParamsInput)
        .query(async ({ ctx, input }): Promise<IssueSearchResult> => {
            const provider: IssueProvider =
                input.provider === "cb"
                    ? new CodebergIssueProvider()
                    : new GitHubIssueProvider();

            return await provider.search({
                ...input,
                ctx: { db: ctx.db, session: ctx.session },
            });
        }),

    searchAutocomplete: protectedProcedure
        .input(providerTargetInput.extend({ query: z.string() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getProviderToken(ctx, input.provider);

            if (input.provider === "cb") {
                return searchCodebergIssues(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.query,
                );
            }
            return searchIssues(
                accessToken,
                input.owner,
                input.repo,
                input.query,
            );
        }),
});
