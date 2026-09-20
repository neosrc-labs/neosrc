import { z } from "zod";
import { providerInput, viewerProcedure } from "~/server/api/trpc";
import { fetchAndCache, readCache, searchCacheKey } from "~/server/cache";
import type { Ctx, SearchProvider } from "./provider";

const searchInput = providerInput({
    owner: z.string(),
    repo: z.string(),
    query: z.string(),
    page: z.number().optional(),
    after: z.string().optional(),
    first: z.number().optional(),
    sort: z.enum(["created", "updated", "comments"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
});

/** Builds the cached and live search procedures shared by list routers. */
export function providerSearchProcedures<TResult>(
    resource: "pulls" | "issues",
    resolveProvider: (provider: "gh" | "cb") => SearchProvider<TResult>,
) {
    return {
        searchCached: viewerProcedure
            .input(searchInput)
            .query(
                ({ ctx, input }): Promise<TResult | null> =>
                    readCache<TResult>(
                        searchCacheKey(resource, ctx.session?.user?.id, input),
                    ),
            ),
        search: viewerProcedure
            .input(searchInput)
            .query(async ({ ctx, input }): Promise<TResult> => {
                const providerCtx: Ctx = {
                    db: ctx.db,
                    session: ctx.session,
                };
                const provider = resolveProvider(input.provider);
                return fetchAndCache(
                    searchCacheKey(resource, ctx.session?.user?.id, input),
                    () => provider.search({ ...input, ctx: providerCtx }),
                    { staleAfter: 0, deleteAfter: 24 * 60 * 60 * 1000 },
                );
            }),
    };
}
