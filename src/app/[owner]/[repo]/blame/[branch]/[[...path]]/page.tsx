import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "~/app/[owner]/[repo]/_components/repo-redirect";
import { encodeRepoPath } from "~/utils/provider-url";

export default async function BlameRedirectPage({
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

    if (github) redirect(`/gh/${owner}/${repo}/blame/${rest}`);
    // Codeberg has no blame view, so the URL degrades to the file.
    if (codeberg) redirect(`/cb/${owner}/${repo}/blob/${rest}`);
    notFound();
}
