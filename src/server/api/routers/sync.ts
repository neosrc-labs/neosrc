import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedMutation } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    isAnonymousToken,
} from "~/server/auth";
import {
    refreshOwnerRepos,
    type SyncResult,
    syncCurrentUser,
} from "~/server/sync";

export const syncRouter = createTRPCRouter({
    /**
     * Upserts the account and repo rows for an owner (user or org) using the
     * caller's token, then refreshes the permission view.
     */
    refreshOwnerRepos: protectedMutation
        .input(
            z.object({
                provider: z.enum(["github", "codeberg"]),
                owner: z.string().min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken =
                input.provider === "github"
                    ? await getGitHubToken(ctx.db, ctx.session?.user?.id)
                    : await getCodebergToken(ctx.db, ctx.session?.user?.id);
            return refreshOwnerRepos(ctx.db, {
                provider: input.provider,
                owner: input.owner,
                accessToken,
            });
        }),

    /**
     * Updates the current user's account row and permissions (org/team
     * memberships and repo grants) for every connected provider.
     */
    currentUser: protectedMutation.mutation(async ({ ctx }) => {
        const userId = ctx.session?.user?.id;
        if (userId) return;
        const [githubToken, codebergToken] = await Promise.all([
            getGitHubToken(ctx.db, userId).catch(() => null),
            getCodebergToken(ctx.db, userId).catch(() => null),
        ]);

        const results: Partial<Record<"github" | "codeberg", SyncResult>> = {};
        await Promise.all([
            githubToken && !isAnonymousToken(githubToken)
                ? syncCurrentUser(ctx.db, {
                      provider: "github",
                      accessToken: githubToken,
                  }).then((result) => {
                      results.github = result;
                  })
                : Promise.resolve(),
            codebergToken
                ? syncCurrentUser(ctx.db, {
                      provider: "codeberg",
                      accessToken: codebergToken,
                  }).then((result) => {
                      results.codeberg = result;
                  })
                : Promise.resolve(),
        ]);

        if (results.github === undefined && results.codeberg === undefined) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "No connected provider accounts to sync",
            });
        }

        return results;
    }),
});
