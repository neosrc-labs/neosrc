import type { Metadata } from "next";
import {
    RepoCodePage,
    type RepoData,
} from "~/app/[owner]/[repo]/_components/repo-code-page";
import { api } from "~/trpc/server";

export interface RepoHomePageProps {
    params: Promise<{ owner: string; repo: string }>;
}

export async function generateRepoHomeMetadata({
    params,
}: RepoHomePageProps): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${owner}/${repo}` };
}

export async function RepoHomePage({
    params,
    provider,
}: RepoHomePageProps & { provider: "gh" | "cb" }) {
    const { owner, repo } = await params;

    const repoDataPromise = api.repos.getByOwnerAndRepo({
        provider,
        owner,
        repo,
    }) as Promise<RepoData>;
    const contributorsPromise = api.repos.getContributors({
        provider,
        owner,
        repo,
    });
    const docFileNamesPromise = api.repos.getDocFileNames({
        provider,
        owner,
        repo,
    });
    const languagesPromise = api.repos.getRepoLanguages({
        provider,
        owner,
        repo,
    });
    const deploymentsPromise = api.repos.getDeployments({
        provider,
        owner,
        repo,
    });
    const latestReleasePromise = api.repos.getLatestRelease({
        provider,
        owner,
        repo,
    });
    const starredPromise = api.repos.getStarred({ provider, owner, repo });
    const subscriptionPromise = api.repos.getSubscription({
        provider,
        owner,
        repo,
    });

    return (
        <RepoCodePage
            provider={provider}
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
