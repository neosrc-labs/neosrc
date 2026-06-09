import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getCheckRuns, getCommitStatuses } from "~/server/github";
import {
    deduplicateCommitStatuses,
    mapStatusToCheckRun,
} from "~/utils/status-checks";

export const checksRouter = createTRPCRouter({
    list: protectedProcedure
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

            const [checks, statuses] = await Promise.all([
                getCheckRuns(accessToken, input.owner, input.repo, input.sha),
                getCommitStatuses(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.sha,
                ),
            ]);
            const checkRunItems = (checks.check_runs ?? []).map((check) => ({
                name: check.name,
                conclusion: check.conclusion,
                status: check.status,
                description: check.output.title ?? check.output.summary,
                html_url: check.html_url ?? undefined,
                details_url: check.details_url,
                started_at: check.started_at,
                completed_at: check.completed_at,
                app: check.app
                    ? {
                          name: check.app.name,
                          owner: check.app.owner
                              ? { avatar_url: check.app.owner.avatar_url }
                              : null,
                      }
                    : null,
            }));

            const statusItems = deduplicateCommitStatuses(statuses ?? []).map(
                mapStatusToCheckRun,
            );

            return [...checkRunItems, ...statusItems];
        }),
});
