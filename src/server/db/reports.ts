import { and, eq, getTableColumns, max, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { pullRequestReport } from "~/server/db/schema";
import * as schema from "~/server/db/schema";

type Db = NodePgDatabase<typeof schema>;

export async function getReportsByPullRequest(
    db: Db,
    input: {
        provider: "github" | "codeberg";
        repository: string;
        prNumber: number;
    },
): Promise<(typeof pullRequestReport.$inferSelect)[]> {
    const baseFilter = and(
        eq(schema.pullRequestReport.provider, input.provider),
        eq(schema.pullRequestReport.repositorySlug, input.repository),
        eq(schema.pullRequestReport.prNumber, input.prNumber),
    );

    const latestRevision = db.$with("latest_revision").as(
        db
            .select({
                provider: schema.pullRequestReport.provider,
                repositorySlug: schema.pullRequestReport.repositorySlug,
                prNumber: schema.pullRequestReport.prNumber,
                name: schema.pullRequestReport.name,
                maxRevision: max(schema.pullRequestReport.revision).as(
                    "max_revision",
                ),
            })
            .from(schema.pullRequestReport)
            .where(baseFilter)
            .groupBy(
                schema.pullRequestReport.provider,
                schema.pullRequestReport.repositorySlug,
                schema.pullRequestReport.prNumber,
                schema.pullRequestReport.name,
            ),
    );

    const rows = await db
        .with(latestRevision)
        .select({ ...getTableColumns(schema.pullRequestReport) })
        .from(schema.pullRequestReport)
        .innerJoin(
            latestRevision,
            and(
                eq(schema.pullRequestReport.provider, latestRevision.provider),
                eq(
                    schema.pullRequestReport.repositorySlug,
                    latestRevision.repositorySlug,
                ),
                eq(schema.pullRequestReport.prNumber, latestRevision.prNumber),
                eq(schema.pullRequestReport.name, latestRevision.name),
                eq(
                    schema.pullRequestReport.revision,
                    latestRevision.maxRevision,
                ),
            ),
        )
        .where(ne(schema.pullRequestReport.state, "REMOVED"));

    return rows;
}
