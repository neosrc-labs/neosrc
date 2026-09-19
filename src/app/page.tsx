import { viewerProviders } from "~/server/api/routers/dashboard";
import { RECENT_ITEM_LIMIT } from "~/server/api/routers/dashboard/types";
import { getLinkedAccounts, getSession } from "~/server/auth";
import { db } from "~/server/db";
import { api, HydrateClient } from "~/trpc/server";

import { HomePage } from "./home-page";
import { LandingPage } from "./landing-page";

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const session = await getSession();
    const params = await searchParams;
    const errorCode = Array.isArray(params.error)
        ? params.error[0]
        : params.error;
    const authError =
        params.authError || errorCode ? (errorCode ?? "sign_in_failed") : null;

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
            <LandingPage authError={authError} />
        </HydrateClient>
    );
}
