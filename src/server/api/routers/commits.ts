import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getCommit } from "~/server/github";

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
});
