import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { log } from "~/logging";
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
     *
     * Providers are independent: one failing provider is reported in the logs
     * and omitted from the result instead of failing the request, so a broken
     * Codeberg token cannot block the GitHub sync.
     */
    currentUser: protectedMutation.mutation(async ({ ctx }) => {
        // protectedMutation guarantees a session; narrow for the token getters
        // and the sync layer, which key sync state by userId.
        if (!ctx.session?.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const userId = ctx.session.user.id;
        const [githubToken, codebergToken] = await Promise.all([
            getGitHubToken(ctx.db, userId).catch(() => null),
            getCodebergToken(ctx.db, userId).catch(() => null),
        ]);

        const results: Partial<Record<"github" | "codeberg", SyncResult>> = {};
        const failures: string[] = [];
        const providers: Array<{
            provider: "github" | "codeberg";
            accessToken: string;
        }> = [];
        // The shared anonymous token exists for unauthenticated browsing; a
        // sync must never run against it (unbounded fetches would burn its
        // rate limit).
        if (githubToken && !isAnonymousToken(githubToken)) {
            providers.push({ provider: "github", accessToken: githubToken });
        }
        if (codebergToken) {
            providers.push({
                provider: "codeberg",
                accessToken: codebergToken,
            });
        }

        await Promise.all(
            providers.map(async ({ provider, accessToken }) => {
                try {
                    results[provider] = await syncCurrentUser(ctx.db, {
                        provider,
                        accessToken,
                        userId,
                        forceFull: true,
                    });
                } catch (error) {
                    // One provider's API failure (revoked token, missing OAuth
                    // scope) must not fail the request or discard the grants
                    // the other providers just synced.
                    failures.push(
                        `${provider}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    log.error(
                        { err: error, provider },
                        "Permission sync failed for provider",
                    );
                }
            }),
        );

        if (providers.length === 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "No connected provider accounts to sync",
            });
        }

        if (Object.keys(results).length === 0) {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Permission sync failed: ${failures.join("; ")}`,
            });
        }

        return results;
    }),

    /**
     * Lightweight incremental sync for periodic polling: short-circuits
     * entirely when the last applied sync is under 5 minutes old (no input
     * fetch), otherwise skips all writes and the permission-view refresh
     * while nothing changed. Silent when no provider is connected (unlike
     * `currentUser`, which is user-initiated). A provider that fails is
     * logged and omitted so it cannot stall the others' polling.
     */
    poll: protectedMutation.mutation(async ({ ctx }) => {
        if (!ctx.session?.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const userId = ctx.session.user.id;
        const [githubToken, codebergToken] = await Promise.all([
            getGitHubToken(ctx.db, userId).catch(() => null),
            getCodebergToken(ctx.db, userId).catch(() => null),
        ]);

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
        const providers: Array<{
            provider: "github" | "codeberg";
            accessToken: string;
        }> = [];
        if (githubToken && !isAnonymousToken(githubToken)) {
            providers.push({ provider: "github", accessToken: githubToken });
        }
        if (codebergToken) {
            providers.push({
                provider: "codeberg",
                accessToken: codebergToken,
            });
        }

        await Promise.all(
            providers.map(async ({ provider, accessToken }) => {
                try {
                    const result = await syncCurrentUser(ctx.db, {
                        provider,
                        accessToken,
                        userId,
                    });
                    const changed = hasChanges(result);
                    results[provider] = {
                        changed,
                        result: changed ? result : null,
                    };
                } catch (error) {
                    // Polling is best effort: a broken provider must not stop
                    // the others from picking up changes.
                    log.error(
                        { err: error, provider },
                        "Incremental permission sync failed for provider",
                    );
                }
            }),
        );

        return results;
    }),
});
