import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import {
    getCommitGraphQL,
    getPullRequestCommitsGraphQL,
} from "~/server/github-graphql";

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

            const commit = await getCommitGraphQL(
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
                cursor: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await getPullRequestCommitsGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.perPage,
                input.cursor ?? undefined,
            );

            return {
                commits: result.commits,
                nextCursor: result.hasNext ? result.endCursor : undefined,
            };
        }),
});
