import type { Metadata } from "next";
import { RepoCodePage } from "~/app/[owner]/[repo]/_components/repo-code-page";
import { loadRepoPageData } from "~/app/[owner]/[repo]/_components/repo-page-data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${owner}/${repo}` };
}

export default async function CodePage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;

    return (
        <RepoCodePage
            provider="gh"
            owner={owner}
            repo={repo}
            {...loadRepoPageData("gh", owner, repo)}
        />
    );
}
