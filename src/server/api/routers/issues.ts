import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getIssue, type IssueSearchItem, searchIssues } from "~/server/github";

export const issuesRouter = createTRPCRouter({
    getByNumber: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                issueNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return getIssue(
                accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
            );
        }),
    search: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const items: IssueSearchItem[] = await searchIssues(
                accessToken,
                input.owner,
                input.repo,
                input.query,
            );

            return items;
        }),
});
