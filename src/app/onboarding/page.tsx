import { redirect } from "next/navigation";

import { getLinkedAccount, getSession } from "~/server/auth";
import { githubAppInstallUrl } from "~/server/auth/github-app";
import { db } from "~/server/db";
import { api } from "~/trpc/server";
import { OnboardingView } from "./_components/onboarding-view";

/**
 * Shown once, right after signing in: prompts the user to install the Neosrc
 * GitHub App so their private repositories are visible. Users who already
 * have a live installation (or have no GitHub account, or run a deployment
 * without the app configured) skip straight to the home page.
 */
export default async function OnboardingPage() {
    const session = await getSession();
    if (!session?.user) redirect("/");

    const githubAccount = await getLinkedAccount(db, session.user.id, "github");
    if (!githubAccount) redirect("/");

    const installations = await api.onboarding.getGitHubAppInstallations();
    if (installations.some((i) => i.suspended_at === null)) redirect("/");

    return <OnboardingView installUrl={githubAppInstallUrl()} />;
}
