import { and, eq, getTableColumns, max } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { pullRequestReport } from "~/server/db/schema";

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

            // FIXME: Need to validate user permissions first!

            const baseFilter = and(
                eq(pullRequestReport.provider, dbProvider),
                eq(pullRequestReport.repositorySlug, input.repository),
                eq(pullRequestReport.prNumber, input.prNumber),
            );

            const latestRevision = ctx.db.$with("latest_revision").as(
                ctx.db
                    .select({
                        provider: pullRequestReport.provider,
                        repositorySlug: pullRequestReport.repositorySlug,
                        prNumber: pullRequestReport.prNumber,
                        name: pullRequestReport.name,
                        maxRevision: max(pullRequestReport.revision).as(
                            "max_revision",
                        ),
                    })
                    .from(pullRequestReport)
                    .where(baseFilter)
                    .groupBy(
                        pullRequestReport.provider,
                        pullRequestReport.repositorySlug,
                        pullRequestReport.prNumber,
                        pullRequestReport.name,
                    ),
            );

            const rows = await ctx.db
                .with(latestRevision)
                .select({ ...getTableColumns(pullRequestReport) })
                .from(pullRequestReport)
                .innerJoin(
                    latestRevision,
                    and(
                        eq(pullRequestReport.provider, latestRevision.provider),
                        eq(
                            pullRequestReport.repositorySlug,
                            latestRevision.repositorySlug,
                        ),
                        eq(pullRequestReport.prNumber, latestRevision.prNumber),
                        eq(pullRequestReport.name, latestRevision.name),
                        eq(
                            pullRequestReport.revision,
                            latestRevision.maxRevision,
                        ),
                    ),
                );

            return rows;
        }),
});
