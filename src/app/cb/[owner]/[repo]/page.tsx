import type { Metadata } from "next";
import { api } from "~/trpc/server";
import type { RepoData } from "../../../[owner]/[repo]/_components/repo-code-page";
import { RepoCodePage } from "../../../[owner]/[repo]/_components/repo-code-page";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${owner}/${repo}` };
}

export default async function CodebergRepoPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;

    const repoDataPromise = api.repos.getByOwnerAndRepo({
        provider: "cb",
        owner,
        repo,
    }) as Promise<RepoData>;
    const contributorsPromise = api.repos.getContributors({
        provider: "cb",
        owner,
        repo,
    });
    const docFileNamesPromise = api.repos.getDocFileNames({
        provider: "cb",
        owner,
        repo,
    });
    const languagesPromise = api.repos.getRepoLanguages({
        provider: "cb",
        owner,
        repo,
    });
    const deploymentsPromise = api.repos.getDeployments({
        provider: "cb",
        owner,
        repo,
    });
    const latestReleasePromise = api.repos.getLatestRelease({
        provider: "cb",
        owner,
        repo,
    });
    const starredPromise = api.repos.getStarred({
        provider: "cb",
        owner,
        repo,
    });
    const subscriptionPromise = api.repos.getSubscription({
        provider: "cb",
        owner,
        repo,
    });

    return (
        <RepoCodePage
            provider="cb"
            owner={owner}
            repo={repo}
            repoDataPromise={repoDataPromise}
            contributorsPromise={contributorsPromise}
            docFileNamesPromise={docFileNamesPromise}
            languagesPromise={languagesPromise}
            deploymentsPromise={deploymentsPromise}
            latestReleasePromise={latestReleasePromise}
            starredPromise={starredPromise}
            subscriptionPromise={subscriptionPromise}
        />
    );
}
