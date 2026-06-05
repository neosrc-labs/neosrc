import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getCommit, getPullRequestCommitsPage } from "~/server/github";

export const commitsRouter = createTRPCRouter({
    getBySha: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                sha: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const commit = await getCommit(
                accessToken,
                input.owner,
                input.repo,
                input.sha,
            );

            return { commit };
        }),

    listForPullRequest: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                perPage: z.number().min(1).max(100).default(30),
                cursor: z.number().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const page = input.cursor ?? 1;
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await getPullRequestCommitsPage(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.perPage,
                page,
            );

            return {
                commits: result.commits,
                nextPage: result.hasNext ? page + 1 : undefined,
            };
        }),
});
