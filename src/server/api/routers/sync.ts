import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireUserId } from "~/server/api/routers/helpers";
import { createTRPCRouter, protectedMutation } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    isAnonymousToken,
} from "~/server/auth";
import type { db } from "~/server/db";
import {
    refreshOwnerRepos,
    type SyncResult,
    syncCurrentUser,
} from "~/server/sync";

/**
 * Both providers' tokens for a user, tolerating unlinked providers (the
 * token getters throw "not connected" when there is no account).
 */
async function getConnectedTokens(
    database: typeof db,
    userId: string,
): Promise<{ githubToken: string | null; codebergToken: string | null }> {
    const [githubToken, codebergToken] = await Promise.all([
        getGitHubToken(database, userId).catch(() => null),
        getCodebergToken(database, userId).catch(() => null),
    ]);
    return { githubToken, codebergToken };
}

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
            try {
                const accessToken =
                    input.provider === "github"
                        ? await getGitHubToken(ctx.db, ctx.session?.user?.id)
                        : await getCodebergToken(ctx.db, ctx.session?.user?.id);
                // The shared anonymous token exists for unauthenticated
                // browsing; a refresh must never run against it (unbounded
                // owner fetches would burn its rate limit).
                if (isAnonymousToken(accessToken)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "GitHub account not connected",
                    });
                }
                return await refreshOwnerRepos(ctx.db, {
                    provider: input.provider,
                    owner: input.owner,
                    accessToken,
                });
            } catch (error) {
                if (error instanceof TRPCError) throw error;
                // Unlinked provider (token getters throw "not connected").
                if (
                    error instanceof Error &&
                    error.message.includes("not connected")
                ) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: error.message,
                    });
                }
                // Unknown owner (Octokit 404 or the codeberg fetcher).
                if (
                    (error as { status?: number } | null)?.status === 404 ||
                    (error instanceof Error &&
                        error.message.includes("not found"))
                ) {
                    throw new TRPCError({ code: "NOT_FOUND" });
                }
                throw error;
            }
        }),

    /**
     * Updates the current user's account row and permissions (org/team
     * memberships and repo grants) for every connected provider. Always
     * performs a full re-sync, regardless of the incremental state.
     */
    currentUser: protectedMutation.mutation(async ({ ctx }) => {
        // protectedMutation guarantees a session; narrow for the token getters
        // and the sync layer, which key sync state by userId.
        const userId = requireUserId(ctx);
        const { githubToken, codebergToken } = await getConnectedTokens(
            ctx.db,
            userId,
        );

        const results: Partial<Record<"github" | "codeberg", SyncResult>> = {};
        await Promise.all([
            githubToken && !isAnonymousToken(githubToken)
                ? syncCurrentUser(ctx.db, {
                      provider: "github",
                      accessToken: githubToken,
                      userId,
                      forceFull: true,
                  }).then((result) => {
                      results.github = result;
                  })
                : Promise.resolve(),
            codebergToken
                ? syncCurrentUser(ctx.db, {
                      provider: "codeberg",
                      accessToken: codebergToken,
                      userId,
                      forceFull: true,
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

    /**
     * Lightweight incremental sync for periodic polling: short-circuits
     * entirely when the last applied sync is under 5 minutes old (no input
     * fetch), otherwise skips all writes and the permission-view refresh
     * while nothing changed. Silent when no provider is connected (unlike
     * `currentUser`, which is user-initiated).
     */
    poll: protectedMutation.mutation(async ({ ctx }) => {
        const userId = requireUserId(ctx);
        const { githubToken, codebergToken } = await getConnectedTokens(
            ctx.db,
            userId,
        );

        const hasChanges = (result: SyncResult): boolean =>
            result.accountsUpserted +
                result.reposUpserted +
                result.relationsWritten +
                result.relationsRemoved +
                result.teamsSkipped >
            0;

        const results: Partial<
            Record<
                "github" | "codeberg",
                { changed: boolean; result: SyncResult | null }
            >
        > = {};
        await Promise.all([
            githubToken && !isAnonymousToken(githubToken)
                ? syncCurrentUser(ctx.db, {
                      provider: "github",
                      accessToken: githubToken,
                      userId,
                  }).then((result) => {
                      results.github = {
                          changed: hasChanges(result),
                          result: hasChanges(result) ? result : null,
                      };
                  })
                : Promise.resolve(),
            codebergToken
                ? syncCurrentUser(ctx.db, {
                      provider: "codeberg",
                      accessToken: codebergToken,
                      userId,
                  }).then((result) => {
                      results.codeberg = {
                          changed: hasChanges(result),
                          result: hasChanges(result) ? result : null,
                      };
                  })
                : Promise.resolve(),
        ]);

        return results;
    }),
});
