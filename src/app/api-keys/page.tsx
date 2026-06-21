import { redirect } from "next/navigation";

import { getSession } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { ApiKeysView } from "./_components/api-keys-view";

export default async function ApiKeysPage() {
    const session = await getSession();
    if (!session?.user) redirect("/");

    return (
        <HydrateClient>
            <main className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                <ApiKeysView />
            </main>
        </HydrateClient>
    );
}
