import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import { getGitHubAppInstallations } from "~/server/github";

export const onboardingRouter = createTRPCRouter({
    getGitHubAppInstallations: protectedProcedure.query(async ({ ctx }) => {
        const accessToken = await getGitHubToken(ctx.db, ctx.session?.user?.id);

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
