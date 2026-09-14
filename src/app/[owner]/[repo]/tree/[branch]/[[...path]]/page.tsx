import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "~/app/[owner]/[repo]/_components/repo-redirect";
import { encodeRepoPath } from "~/utils/provider-url";

export default async function TreeRedirectPage({
    params,
}: {
    params: Promise<{
        owner: string;
        repo: string;
        branch: string;
        path?: string[];
    }>;
}) {
    const { owner, repo, branch, path } = await params;
    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    const encodedPath = path?.length
        ? `/${encodeRepoPath(path.join("/"))}`
        : "";
    const rest = `${encodeURIComponent(branch)}${encodedPath}`;

    if (github) redirect(`/gh/${owner}/${repo}/tree/${rest}`);
    if (codeberg) redirect(`/cb/${owner}/${repo}/tree/${rest}`);
    notFound();
}
