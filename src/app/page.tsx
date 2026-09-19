import { viewerProviders } from "~/server/api/routers/dashboard";
import { RECENT_ITEM_LIMIT } from "~/server/api/routers/dashboard/types";
import { getLinkedAccounts, getSession } from "~/server/auth";
import { db } from "~/server/db";
import { api, HydrateClient } from "~/trpc/server";

import { HomePage } from "./home-page";
import { LandingPage } from "./landing-page";

export default async function Home() {
    const session = await getSession();

    if (session) {
        const accounts = await getLinkedAccounts(db, session.user.id);
        const providers = viewerProviders(accounts);

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
