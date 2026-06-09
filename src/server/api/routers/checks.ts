import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { getCheckRuns } from "~/server/github";

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

            const checks = await getCheckRuns(
                accessToken,
                input.owner,
                input.repo,
                input.sha,
            );

            return (checks.check_runs ?? []).map(
                (check: {
                    name: string;
                    conclusion: string | null;
                    status: string;
                    html_url?: string;
                    details_url?: string | null;
                    started_at?: string | null;
                    completed_at?: string | null;
                    app?: {
                        name: string;
                        icon?: string | null;
                    } | null;
                }) => ({
                    name: check.name,
                    conclusion: check.conclusion,
                    status: check.status,
                    html_url: check.html_url,
                    details_url: check.details_url,
                    started_at: check.started_at,
                    completed_at: check.completed_at,
                    app: check.app
                        ? { name: check.app.name, icon: check.app.icon }
                        : null,
                }),
            );
        }),
});
