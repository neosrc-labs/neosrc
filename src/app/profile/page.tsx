import { redirect } from "next/navigation";

import { getSession } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { ProfileView } from "./_components/profile-view";

export default async function ProfilePage() {
    const session = await getSession();
    if (!session?.user) redirect("/");

    const user = session.user as {
        name: string;
        githubUsername?: string;
        codebergUsername?: string;
        image?: string;
    };

    return (
        <HydrateClient>
            <main className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                <ProfileView
                    name={user.name}
                    image={user.image ?? null}
                    githubUsername={user.githubUsername ?? null}
                    codebergUsername={user.codebergUsername ?? null}
                />
            </main>
        </HydrateClient>
    );
}
