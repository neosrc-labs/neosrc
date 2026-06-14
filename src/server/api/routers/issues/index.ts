import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
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
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                issueNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken =
                input.provider === "cb"
                    ? await getCodebergToken(ctx.db, ctx.session.user.id)
                    : await getGitHubToken(ctx.db, ctx.session.user.id);

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
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
                page: z.number().optional(),
                after: z.string().optional(),
                first: z.number().optional(),
                sort: z.enum(["created", "updated", "comments"]).optional(),
                order: z.enum(["asc", "desc"]).optional(),
            }),
        )
        .query(async ({ ctx, input }): Promise<IssueSearchResult> => {
            const provider: IssueProvider =
                input.provider === "cb"
                    ? new CodebergIssueProvider()
                    : new GitHubIssueProvider();

            return provider.search({
                ...input,
                ctx: { db: ctx.db, session: ctx.session },
            });
        }),

    searchAutocomplete: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken =
                input.provider === "cb"
                    ? await getCodebergToken(ctx.db, ctx.session.user.id)
                    : await getGitHubToken(ctx.db, ctx.session.user.id);

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
