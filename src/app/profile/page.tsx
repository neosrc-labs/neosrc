import { redirect } from "next/navigation";

import {
    getLinkedAccounts,
    getSession,
    isCodebergConfigured,
} from "~/server/auth";
import { githubAppInstallUrl } from "~/server/auth/github-app";
import { db } from "~/server/db";
import { HydrateClient } from "~/trpc/server";
import { ProfileView } from "./_components/profile-view";

export default async function ProfilePage() {
    const session = await getSession();
    if (!session?.user) redirect("/");

    const { name, image } = session.user;
    const accounts = await getLinkedAccounts(db, session.user.id);

    return (
        <HydrateClient>
            <main className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                <ProfileView
                    name={name}
                    image={image ?? null}
                    accounts={accounts}
                    githubAppInstallationUrl={githubAppInstallUrl()}
                    codebergEnabled={isCodebergConfigured()}
                />
            </main>
        </HydrateClient>
    );
}
