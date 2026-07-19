import { getSession } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

import { HomePage } from "./home-page";
import { LandingPage } from "./landing-page";

export default async function Home() {
    const session = await getSession();

    return (
        <HydrateClient>
            {session ? <HomePage /> : <LandingPage />}
        </HydrateClient>
    );
}
