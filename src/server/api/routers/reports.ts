import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, viewerProcedure } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    getLinkedAccount,
} from "~/server/auth";
import { getCachedRepo as getCachedCodebergRepo } from "~/server/codeberg";
import { getReportsByPullRequest } from "~/server/db/reports";
import { getCachedRepo as getCachedGitHubRepo } from "~/server/github";
import {
    getRepoPermissionForUser,
    RepoNotFoundError,
    viewerRepoAccess,
} from "~/server/repo-cache";

export const reportsRouter = createTRPCRouter({
    getReportsByPullRequest: viewerProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]),
                repository: z.string().regex(/^[^/]+\/[^/]+$/),
                prNumber: z.number().int().positive(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const dbProvider = input.provider === "gh" ? "github" : "codeberg";
            const [owner, repo] = input.repository.split("/") as [
                string,
                string,
            ];
            const linkedAccount = ctx.session?.user
                ? await getLinkedAccount(
                      ctx.db,
                      ctx.session.user.id,
                      dbProvider,
                  )
                : undefined;
            const username =
                linkedAccount?.connectionStatus === "active"
                    ? linkedAccount.username
                    : null;
            const accessToken =
                input.provider === "gh"
                    ? await getGitHubToken(ctx.db, ctx.session?.user?.id)
                    : await getCodebergToken(ctx.db, ctx.session?.user?.id);
            const [repository, permission] = await Promise.all([
                (input.provider === "gh"
                    ? getCachedGitHubRepo(accessToken, owner, repo)
                    : getCachedCodebergRepo(accessToken, owner, repo)
                ).catch((error) => {
                    if (error instanceof RepoNotFoundError) {
                        throw new TRPCError({ code: "NOT_FOUND" });
                    }
                    throw error;
                }),
                getRepoPermissionForUser(dbProvider, username, owner, repo),
            ]);
            const access = viewerRepoAccess({
                username,
                payload: repository,
                permission,
            });
            if (!access.canView) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            return getReportsByPullRequest(ctx.db, {
                provider: dbProvider,
                repository: input.repository,
                prNumber: input.prNumber,
            });
        }),
});
