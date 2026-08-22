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
import { flattenError, ZodError } from "zod";
import { env } from "~/env";
import { log } from "~/logging";
import { getSession } from "~/server/auth";
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
