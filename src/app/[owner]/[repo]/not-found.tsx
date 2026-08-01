import { getSession } from "~/server/auth";
import { RepoNotFound } from "./_components/repo-not-found";

export default async function NotFound() {
    const session = await getSession();
    return <RepoNotFound signedIn={!!session?.user} />;
}
