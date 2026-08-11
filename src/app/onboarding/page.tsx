import { redirect } from "next/navigation";

import { getSession } from "~/server/auth";
import { githubAppInstallUrl } from "~/server/auth/github-app";
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

    const user = session.user as { id: string; githubUsername?: string };
    if (!user.githubUsername) redirect("/");

    const installations = await api.onboarding.getGitHubAppInstallations();
    if (installations.some((i) => i.suspended_at === null)) redirect("/");

    return <OnboardingView installUrl={githubAppInstallUrl()} />;
}
