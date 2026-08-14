import { env } from "~/env";
import { getGhToken } from "~/server/api/routers/helpers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isAnonymousToken } from "~/server/auth";
import { getGitHubAppInstallations } from "~/server/github";

export const onboardingRouter = createTRPCRouter({
    getGitHubAppInstallations: protectedProcedure.query(async ({ ctx }) => {
        const accessToken = await getGhToken(ctx);

        if (isAnonymousToken(accessToken) || !env.GITHUB_APP_SLUG) {
            // User not logged in or we does not github apps enabled
            return [];
        }

        return await getGitHubAppInstallations(
            accessToken,
            env.GITHUB_APP_SLUG,
        );
    }),
});
