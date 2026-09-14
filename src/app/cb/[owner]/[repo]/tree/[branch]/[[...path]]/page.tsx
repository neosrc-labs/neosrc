import type { Metadata } from "next";
import {
    loadRepoHeaderData,
    loadRepoPageData,
} from "~/app/[owner]/[repo]/_components/repo-page-data";
import { RepoTreePage } from "~/app/[owner]/[repo]/_components/repo-tree-page";

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

export default async function CodebergTreePage({
    params,
}: {
    params: Promise<TreeParams>;
}) {
    const { owner, repo, branch, path } = await params;
    const repoPath = (path ?? []).join("/");

    return (
        <RepoTreePage
            provider="cb"
            owner={owner}
            repo={repo}
            selectedRef={branch}
            path={repoPath}
            // A path page shows no About column, so it needs no About queries.
            {...(repoPath
                ? loadRepoHeaderData("cb", owner, repo)
                : loadRepoPageData("cb", owner, repo))}
        />
    );
}
