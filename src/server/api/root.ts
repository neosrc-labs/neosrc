import { issuesRouter } from "~/server/api/routers/issues";
import { pullsRouter } from "~/server/api/routers/pulls";
import { reactionsRouter } from "~/server/api/routers/reactions";
import { reviewCommentsRouter } from "~/server/api/routers/reviewComments";
import { reviewsRouter } from "~/server/api/routers/reviews";
import { timelineRouter } from "~/server/api/routers/timeline";
import { usersRouter } from "~/server/api/routers/users";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	issues: issuesRouter,
	pulls: pullsRouter,
	reactions: reactionsRouter,
	reviewComments: reviewCommentsRouter,
	reviews: reviewsRouter,
	timeline: timelineRouter,
	users: usersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
