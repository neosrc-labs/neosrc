import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getReportsByPullRequest } from "~/server/db/reports";

export const reportsRouter = createTRPCRouter({
    getReportsByPullRequest: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]),
                repository: z.string(),
                prNumber: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const dbProvider = input.provider === "gh" ? "github" : "codeberg";

            return getReportsByPullRequest(ctx.db, {
                provider: dbProvider,
                repository: input.repository,
                prNumber: input.prNumber,
            });
        }),
});
