import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepoDirectoryPage } from "~/components/repo/repo-directory-page";
import { loadRepoPageData } from "~/components/repo/repo-page-data";
import { RepoTreePage } from "~/components/repo/repo-tree-page";
import { parseRepositoryReference } from "~/utils/provider-url";

interface TreeParams {
    owner: string;
    repo: string;
    branch: string;
    path?: string[];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<TreeParams>;
}): Promise<Metadata> {
    const { owner, repo, branch, path } = await params;
    return {
        title: `${path?.join("/") || repo} at ${branch} - ${owner}/${repo}`,
    };
}

export default async function TreePage({
    params,
    searchParams,
}: {
    params: Promise<TreeParams>;
    searchParams: Promise<{ refKind?: string | string[] }>;
}) {
    const { owner, repo, branch, path } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    const repoPath = (path ?? []).join("/");

    // The branch root is the repo root view; a path inside it is a directory
    // page, which renders no repo name header and no About column.
    if (repoPath !== "") {
        return (
            <RepoDirectoryPage
                provider="cb"
                owner={owner}
                repo={repo}
                reference={reference}
                path={repoPath}
            />
        );
    }

    return (
        <RepoTreePage
            provider="cb"
            owner={owner}
            repo={repo}
            reference={reference}
            {...loadRepoPageData("cb", owner, repo)}
        />
    );
}
