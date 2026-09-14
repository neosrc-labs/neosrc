import type { Metadata } from "next";
import { RepoDirectoryPage } from "~/app/[owner]/[repo]/_components/repo-directory-page";
import {
    loadRepoPageData,
    loadRepoPathData,
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

export default async function TreePage({
    params,
}: {
    params: Promise<TreeParams>;
}) {
    const { owner, repo, branch, path } = await params;
    const repoPath = (path ?? []).join("/");

    // The branch root is the repo root view; a path inside it is a directory
    // page, which renders no repo name header and no About column.
    if (repoPath !== "") {
        return (
            <RepoDirectoryPage
                provider="gh"
                owner={owner}
                repo={repo}
                selectedRef={branch}
                path={repoPath}
                {...loadRepoPathData("gh", owner, repo)}
            />
        );
    }

    return (
        <RepoTreePage
            provider="gh"
            owner={owner}
            repo={repo}
            selectedRef={branch}
            {...loadRepoPageData("gh", owner, repo)}
        />
    );
}
