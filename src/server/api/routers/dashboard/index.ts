import { z } from "zod";

import { log } from "~/logging";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import type { db } from "~/server/db";
import {
    fetchViewerCodebergIssues,
    fetchViewerCodebergPulls,
} from "./codeberg";
import { fetchViewerIssues, fetchViewerPulls } from "./github";
import type {
    ViewerIssueItem,
    ViewerItemList,
    ViewerItemProvider,
    ViewerPullItem,
} from "./types";
import { RECENT_ITEM_LIMIT } from "./types";

/** `all` merges both providers; the others restrict the request to one. */
export type ProviderFilter = "all" | "gh" | "cb";

type ViewerItemLoad<T> = {
    provider: ViewerItemProvider;
    run: () => Promise<T[]>;
};

/**
 * Loads every requested provider in parallel and merges the results into one
 * list, newest activity first. A provider that fails (unlinked, expired token,
 * upstream error) is reported instead of failing the whole list.
 */
export async function mergeViewerItems<T extends { updatedAt: string }>(
    loads: ViewerItemLoad<T>[],
    limit: number,
): Promise<ViewerItemList<T>> {
    const results = await Promise.all(
        loads.map(async ({ provider, run }) => {
            try {
                return { provider, items: await run(), failed: false };
            } catch (error) {
                log.error({ err: error, provider }, "viewer items failed");
                return { provider, items: [] as T[], failed: true };
            }
        }),
    );

    const items = results
        .flatMap((result) => result.items)
        // Codeberg stamps RFC 3339 offsets and GitHub uses UTC, so compare
        // parsed timestamps rather than the raw strings.
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    return {
        items: items.slice(0, limit),
        unavailable: results
            .filter((result) => result.failed)
            .map((result) => result.provider),
    };
}

/**
 * Providers the viewer has an account for.
 *
 * A linked account is required: without one the token getters fall back to the
 * deployment's shared browsing token, and that account's own activity is not
 * the viewer's. Codeberg has no fallback at all.
 */
export function viewerProviders(user: {
    githubUsername: string | null;
    codebergUsername: string | null;
}): ViewerItemProvider[] {
    const providers: ViewerItemProvider[] = [];
    if (user.githubUsername) providers.push("gh");
    if (user.codebergUsername) providers.push("cb");
    return providers;
}

/** One load per provider the viewer can be queried as. */
function viewerItemLoads<T>(args: {
    db: typeof db;
    userId: string;
    providers: ViewerItemProvider[];
    limit: number;
    github: (accessToken: string, limit: number) => Promise<T[]>;
    codeberg: (accessToken: string, limit: number) => Promise<T[]>;
}): ViewerItemLoad<T>[] {
    return args.providers.map((provider) => ({
        provider,
        run: async () => {
            if (provider === "gh") {
                return args.github(
                    await getGitHubToken(args.db, args.userId),
                    args.limit,
                );
            }
            return args.codeberg(
                await getCodebergToken(args.db, args.userId),
                args.limit,
            );
        },
    }));
}

/** Requested providers that the viewer can actually be queried as. */
function requestedProviders(
    user: {
        githubUsername?: string | null;
        codebergUsername?: string | null;
    },
    filter: ProviderFilter,
): ViewerItemProvider[] {
    return viewerProviders({
        githubUsername: user.githubUsername ?? null,
        codebergUsername: user.codebergUsername ?? null,
    }).filter((provider) => filter === "all" || provider === filter);
}

const listInput = {
    provider: z.enum(["all", "gh", "cb"]).default("all"),
    limit: z.number().int().min(1).max(50).default(RECENT_ITEM_LIMIT),
};

export const dashboardRouter = createTRPCRouter({
    recentPulls: protectedProcedure
        .input(z.object(listInput))
        .query(
            async ({ ctx, input }): Promise<ViewerItemList<ViewerPullItem>> => {
                const user = ctx.session?.user;
                if (!user) return { items: [], unavailable: [] };

                return mergeViewerItems(
                    viewerItemLoads({
                        db: ctx.db,
                        userId: user.id,
                        providers: requestedProviders(user, input.provider),
                        limit: input.limit,
                        github: fetchViewerPulls,
                        codeberg: fetchViewerCodebergPulls,
                    }),
                    input.limit,
                );
            },
        ),

    recentIssues: protectedProcedure
        .input(z.object(listInput))
        .query(
            async ({
                ctx,
                input,
            }): Promise<ViewerItemList<ViewerIssueItem>> => {
                const user = ctx.session?.user;
                if (!user) return { items: [], unavailable: [] };

                return mergeViewerItems(
                    viewerItemLoads({
                        db: ctx.db,
                        userId: user.id,
                        providers: requestedProviders(user, input.provider),
                        limit: input.limit,
                        github: fetchViewerIssues,
                        codeberg: fetchViewerCodebergIssues,
                    }),
                    input.limit,
                );
            },
        ),
});
