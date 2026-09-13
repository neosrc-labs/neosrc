import { RedirectToExternal } from "~/components/redirect-to-external";
import { getSession } from "~/server/auth";
import { externalFallbackTarget } from "~/server/extension-fallback";
import { RepoNotFound } from "./_components/repo-not-found";

export default async function NotFound() {
    // Reached through the extension, this repository exists on the host; go
    // there instead of showing a Neosrc 404.
    const fallback = await externalFallbackTarget();
    if (fallback) return <RedirectToExternal href={fallback} />;

    const session = await getSession();
    return <RepoNotFound signedIn={!!session?.user} />;
}
