import { api } from "~/trpc/server";
import type { Provider } from "~/utils/provider-url";
import type { RepoData, RepoPageData } from "./repo-page-types";

/**
 * Starts the repo queries shared by every repo page view. Called from a server
 * component; the promises stream into `RepoPageBody` via Suspense.
 */
export function loadRepoPageData(
    provider: Provider,
    owner: string,
    repo: string,
): RepoPageData {
    return {
        ...loadRepoHeaderData(provider, owner, repo),
        about: {
            contributorsPromise: api.repos.getContributors({
                provider,
                owner,
                repo,
            }),
            languagesPromise: api.repos.getRepoLanguages({
                provider,
                owner,
                repo,
            }),
            deploymentsPromise: api.repos.getDeployments({
                provider,
                owner,
                repo,
            }),
            latestReleasePromise: api.repos.getLatestRelease({
                provider,
                owner,
                repo,
            }),
        },
    };
}

/**
 * Header-only variant for views that do not render the About column, so a
 * file or directory page costs no contributor, language or release queries.
 */
export function loadRepoHeaderData(
    provider: Provider,
    owner: string,
    repo: string,
): RepoPageData {
    return {
        // The router types `defaultBranch` as nullable because the provider
        // payload can lack it; every repo the page renders has one.
        repoDataPromise: api.repos.getByOwnerAndRepo({
            provider,
            owner,
            repo,
        }) as Promise<RepoData>,
        docFileNamesPromise: api.repos.getDocFileNames({
            provider,
            owner,
            repo,
        }),
        starredPromise: api.repos.getStarred({ provider, owner, repo }),
        subscriptionPromise: api.repos.getSubscription({
            provider,
            owner,
            repo,
        }),
    };
}
