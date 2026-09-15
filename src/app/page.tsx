import { viewerProviders } from "~/server/api/routers/dashboard";
import { RECENT_ITEM_LIMIT } from "~/server/api/routers/dashboard/types";
import { getSession } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

import { HomePage } from "./home-page";
import { LandingPage } from "./landing-page";

export default async function Home() {
    const session = await getSession();

    if (session) {
        const user = session.user as {
            githubUsername?: string | null;
            codebergUsername?: string | null;
        };
        // Same rule the router applies, so the filter always matches the
        // providers the lists are actually loaded from.
        const providers = viewerProviders({
            githubUsername: user.githubUsername ?? null,
            codebergUsername: user.codebergUsername ?? null,
        });

        void api.repos.getTopRepos.prefetch();
        void api.dashboard.recentPulls.prefetch({
            provider: "all",
            limit: RECENT_ITEM_LIMIT,
        });
        void api.dashboard.recentIssues.prefetch({
            provider: "all",
            limit: RECENT_ITEM_LIMIT,
        });

        return (
            <HydrateClient>
                <HomePage providers={providers} />
            </HydrateClient>
        );
    }

    return (
        <HydrateClient>
            <LandingPage />
        </HydrateClient>
    );
}
