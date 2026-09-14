import type { Metadata } from "next";
import { loadRepoPageData } from "~/app/[owner]/[repo]/_components/repo-page-data";
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

export default async function TreePage({
    params,
}: {
    params: Promise<TreeParams>;
}) {
    const { owner, repo, branch, path } = await params;

    return (
        <RepoTreePage
            provider="gh"
            owner={owner}
            repo={repo}
            selectedRef={branch}
            path={(path ?? []).join("/")}
            {...loadRepoPageData("gh", owner, repo)}
        />
    );
}
