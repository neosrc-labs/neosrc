import { apiKeysRouter } from "~/server/api/routers/api-keys";
import { checksRouter } from "~/server/api/routers/checks";
import { commitsRouter } from "~/server/api/routers/commits";
import { issuesRouter } from "~/server/api/routers/issues";
import { onboardingRouter } from "~/server/api/routers/onboarding";
import { pullsRouter } from "~/server/api/routers/pulls";
import { reactionsRouter } from "~/server/api/routers/reactions";
import { reportsRouter } from "~/server/api/routers/reports";
import { reposRouter } from "~/server/api/routers/repos";
import { reviewCommentsRouter } from "~/server/api/routers/review-comments";
import { reviewsRouter } from "~/server/api/routers/reviews";
import { syncRouter } from "~/server/api/routers/sync";
import { timelineRouter } from "~/server/api/routers/timeline";
import { usersRouter } from "~/server/api/routers/users";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

// This is the primary router for your server.
//
// All routers added in /api/routers should be manually added here.
export const appRouter = createTRPCRouter({
    apiKeys: apiKeysRouter,
    checks: checksRouter,
    commits: commitsRouter,
    issues: issuesRouter,
    onboarding: onboardingRouter,
    pulls: pullsRouter,
    reactions: reactionsRouter,
    reports: reportsRouter,
    repos: reposRouter,
    reviewComments: reviewCommentsRouter,
    reviews: reviewsRouter,
    sync: syncRouter,
    timeline: timelineRouter,
    users: usersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

// Create a server-side caller for the tRPC API.
export const createCaller = createCallerFactory(appRouter);
