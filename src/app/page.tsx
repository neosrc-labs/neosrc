import { getSession } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

import { HomePage } from "./home-page";
import { LandingPage } from "./landing-page";

export default async function Home() {
    const session = await getSession();

    if (session) {
        void api.repos.getTopRepos.prefetch();
        return (
            <HydrateClient>
                <HomePage />
            </HydrateClient>
        );
    }

    return (
        <HydrateClient>
            <LandingPage />
        </HydrateClient>
    );
}
