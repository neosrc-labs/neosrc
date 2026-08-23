/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { flattenError, ZodError, z } from "zod";
import { env } from "~/env";
import { log } from "~/logging";
import { getCodebergToken, getGitHubToken, getSession } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
    const session = await getSession();

    return {
        db,
        session,
        isAnonymous: !session?.user && !!env.GITHUB_ANONYMOUS_TOKEN,
        ...opts,
    };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError:
                    error.cause instanceof ZodError
                        ? flattenError(error.cause)
                        : null,
            },
        };
    },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

const loggingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
    const start = performance.now();
    const result = await next();
    const durationMs = Number((performance.now() - start).toFixed(2));

    const metadata = {
        type,
        path,
        durationMs,
        userId: ctx.session?.user?.id ?? "anonymous",
    };

    if (result.ok) {
        log.info(metadata, `[tRPC] ${type} ${path} completed`);
    } else {
        log.error(
            {
                ...metadata,
                errorCode: result.error.code,
                cause: result.error.cause,
            },
            `[tRPC] ${type} ${path} failed`,
        );
    }

    return result;
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
    .use(loggingMiddleware)
    .use(({ ctx, next }) => {
        if (!ctx.session?.user && !env.GITHUB_ANONYMOUS_TOKEN) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return next({
            ctx: {
                session: ctx.session
                    ? { ...ctx.session, user: ctx.session.user }
                    : null,
            },
        });
    });

/**
 * Session-required middleware.
 *
 * Throws UNAUTHORIZED when there is no real logged-in session, so anonymous
 * visitors (who may browse with the shared GITHUB_ANONYMOUS_TOKEN) cannot
 * perform write operations.
 */
export const requireSession = t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next();
});

/**
 * Protected mutation procedure: requires a real logged-in session.
 *
 * Anonymous visitors can still read through `protectedProcedure`, but every
 * write path goes through this procedure so mutations always run as a real
 * user (never with the shared anonymous token).
 */
export const protectedMutation = protectedProcedure.use(requireSession);

/**
 * Provider-aware procedure builders.
 *
 * Most repo/PR procedures repeat the same shape: read `input.provider`,
 * fetch the matching access token, call the provider function, optionally
 * evict a cache key. These builders centralize that plumbing so each
 * procedure only states what differs: the handlers, how the user id is
 * resolved, the Codeberg fallback, and whether caches are evicted.
 */

type BuilderUser = {
    id: string;
    githubUsername?: string | null;
    codebergUsername?: string | null;
};

type HandlerCtx = {
    db: typeof db;
    session: { user?: BuilderUser } | null;
};

type ProviderId = "gh" | "cb";

/** Adds the standard `provider` discriminator to a procedure's input. */
export function providerInput<T extends z.ZodRawShape>(shape: T) {
    return z.object({ provider: z.enum(["gh", "cb"]).default("gh"), ...shape });
}

/**
 * How a builder resolves the user id passed to the token getters:
 * as-is passes `ctx.session?.user?.id` through (possibly undefined, which
 * the GitHub getter maps to the shared anonymous token); anonymous falls
 * back to the string "anonymous", which keyed caches expect.
 */
type UserIdMode = "as-is" | "anonymous";
type ResolvedUserId<Mode extends UserIdMode> = Mode extends "anonymous"
    ? string
    : string | undefined;

type ProviderHandler<I, UserId, R> = (args: {
    ctx: HandlerCtx;
    input: I;
    accessToken: string;
    userId: UserId;
}) => Promise<R>;

/** Exactly one Codeberg side per procedure: either a handler or a fallback. */
type CodebergSide<I, UserId, R> =
    | { cb: ProviderHandler<I, UserId, R>; cbFallback?: never }
    | { cb?: never; cbFallback: () => R };

export function providerQuery<
    S extends z.ZodType<{ provider: ProviderId }>,
    R,
    Mode extends UserIdMode = "as-is",
>(
    config: {
        input: S;
        userId?: Mode;
        gh: ProviderHandler<z.output<S>, ResolvedUserId<Mode>, R>;
    } & CodebergSide<z.output<S>, ResolvedUserId<Mode>, R>,
) {
    return protectedProcedure
        .input(config.input)
        .query(async ({ ctx, input }) => {
            const userId = (
                config.userId === "anonymous"
                    ? (ctx.session?.user?.id ?? "anonymous")
                    : ctx.session?.user?.id
            ) as ResolvedUserId<Mode>;
            if (input.provider === "cb") {
                if (!config.cb) return config.cbFallback();
                const accessToken = await getCodebergToken(ctx.db, userId);
                return config.cb({
                    ctx,
                    // After .input() parsing the runtime value is exactly
                    // z.output<S>; tRPC's conditional parser type cannot
                    // prove it.
                    input: input as z.output<S>,
                    accessToken,
                    userId,
                });
            }
            const accessToken = await getGitHubToken(ctx.db, userId);
            return config.gh({
                ctx,
                input: input as z.output<S>,
                accessToken,
                userId,
            });
        });
}

/**
 * Mutation variant. Mutations always run as a real user (`protectedMutation`),
 * so the user id is guaranteed; eviction is opt-in because some mutations
 * deliberately skip it.
 */
export function providerMutation<
    S extends z.ZodType<{ provider: ProviderId }>,
    R,
>(
    config: {
        input: S;
        gh: ProviderHandler<z.output<S>, string, R>;
        /** Cache key evicted after the mutation succeeds. */
        evict?: (args: {
            provider: ProviderId;
            userId: string;
            input: z.output<S>;
        }) => string;
    } & CodebergSide<z.output<S>, string, R>,
) {
    return protectedMutation
        .input(config.input)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id;
            if (!userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }
            let result: R;
            if (input.provider === "cb") {
                if (!config.cb) {
                    result = config.cbFallback();
                } else {
                    const accessToken = await getCodebergToken(ctx.db, userId);
                    result = await config.cb({
                        ctx,
                        input: input as z.output<S>,
                        accessToken,
                        userId,
                    });
                }
            } else {
                const accessToken = await getGitHubToken(ctx.db, userId);
                result = await config.gh({
                    ctx,
                    input: input as z.output<S>,
                    accessToken,
                    userId,
                });
            }
            if (config.evict) {
                await deleteCache(
                    config.evict({
                        provider: input.provider,
                        userId,
                        input: input as z.output<S>,
                    }),
                );
            }
            return result;
        });
}

type GitHubArgs<I> = {
    ctx: HandlerCtx;
    input: I;
    accessToken: string;
};

export function githubQuery<S extends z.ZodType, R>(config: {
    input: S;
    run: (args: GitHubArgs<z.output<S>>) => Promise<R>;
}) {
    return protectedProcedure
        .input(config.input)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
            return config.run({
                ctx,
                input: input as z.output<S>,
                accessToken,
            });
        });
}

const prRefSchema = z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
});
type PrRefInput = z.infer<typeof prRefSchema>;

/**
 * GitHub-only PR mutation builder. `onSuccess` covers post-success work such
 * as additional cache evictions; it is skipped when `run` throws. `evictPr`
 * is only available for inputs carrying owner/repo/number, since that triple
 * is what the standard PR cache key is built from.
 */
type EvictPrOption<S extends z.ZodType> =
    z.output<S> extends PrRefInput
        ? { evictPr?: boolean }
        : { evictPr?: undefined };

export function githubMutation<S extends z.ZodType, R>(
    config: {
        input: S;
        run: (args: GitHubArgs<z.output<S>>) => Promise<R>;
        onSuccess?: (
            args: GitHubArgs<z.output<S>> & { result: R },
        ) => Promise<void>;
    } & EvictPrOption<S>,
) {
    return protectedMutation
        .input(config.input)
        .mutation(async ({ ctx, input }) => {
            // After .input() parsing the runtime value is exactly
            // z.output<S>; tRPC's conditional parser type cannot prove it.
            const parsed = input as z.output<S>;
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
            const result = await config.run({
                ctx,
                input: parsed,
                accessToken,
            });
            if (config.evictPr) {
                const ref = parsed as z.output<S> & PrRefInput;
                await deleteCache(prCacheKey(ref.owner, ref.repo, ref.number));
            }
            await config.onSuccess?.({
                ctx,
                input: parsed,
                accessToken,
                result,
            });
            return result;
        });
}
