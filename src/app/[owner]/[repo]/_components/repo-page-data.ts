import { api } from "~/trpc/server";
import type { Provider } from "~/utils/provider-url";
import type {
    RepoData,
    RepoPageData,
    RepoPathPageData,
} from "./repo-page-types";

/**
 * Repository query shared by every repo page view. Called from a server
 * component; the promise streams into the view via Suspense.
 *
 * The router types `defaultBranch` as nullable because the provider payload
 * can lack it; every repo the page renders has one.
 */
function repoDataPromise(
    provider: Provider,
    owner: string,
    repo: string,
): Promise<RepoData> {
    return api.repos.getByOwnerAndRepo({
        provider,
        owner,
        repo,
    }) as Promise<RepoData>;
}

/**
 * Starts the queries of the file and directory pages, which render neither
 * the repo name header nor the About column.
 */
export function loadRepoPathData(
    provider: Provider,
    owner: string,
    repo: string,
): RepoPathPageData {
    return { repoDataPromise: repoDataPromise(provider, owner, repo) };
}

/**
 * Starts the repo queries of the views that render the repo name header and
 * the About column, so both stream in with the page-specific content.
 */
export function loadRepoPageData(
    provider: Provider,
    owner: string,
    repo: string,
): RepoPageData {
    return {
        ...loadRepoPathData(provider, owner, repo),
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
