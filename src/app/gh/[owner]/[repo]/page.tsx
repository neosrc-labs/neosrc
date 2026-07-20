import type { Metadata } from "next";
import { api } from "~/trpc/server";
import type { RepoData } from "./_components/repo-code-page";
import { RepoCodePage } from "./_components/repo-code-page";

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

    const repoDataPromise = api.repos.getByOwnerAndRepo({
        provider: "gh",
        owner,
        repo,
    }) as Promise<RepoData>;
    const contributorsPromise = api.repos.getContributors({ owner, repo });
    const docFileNamesPromise = api.repos.getDocFileNames({ owner, repo });
    const languagesPromise = api.repos.getRepoLanguages({ owner, repo });
    const starredPromise = api.repos.getStarred({ owner, repo });
    const subscriptionPromise = api.repos.getSubscription({ owner, repo });

    return (
        <RepoCodePage
            owner={owner}
            repo={repo}
            repoDataPromise={repoDataPromise}
            contributorsPromise={contributorsPromise}
            docFileNamesPromise={docFileNamesPromise}
            languagesPromise={languagesPromise}
            starredPromise={starredPromise}
            subscriptionPromise={subscriptionPromise}
        />
    );
}
