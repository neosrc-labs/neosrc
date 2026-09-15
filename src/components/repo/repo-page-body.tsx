"use client";

import type { ReactNode } from "react";
import { Async } from "~/components/async";
import type { Provider } from "~/utils/provider-url";
import { RepoHeader } from "./repo-header";
import type { RepoData, RepoPageData } from "./repo-page-types";
import { RepoSidebar, RepoSidebarSkeleton } from "./repo-sidebar";

interface RepoPageBodyProps extends RepoPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Shown while the repo query resolves, in place of `children`. */
    contentFallback: ReactNode;
    children: (repoData: RepoData) => ReactNode;
}

/**
 * Repo name header, content column and About column, shared by the repo code
 * page and the branch root. The file and directory pages render only their main
 * column instead, with neither the header nor the About column.
 */
export function RepoPageBody({
    owner,
    repo,
    provider,
    repoDataPromise,
    docFileNamesPromise,
    starredPromise,
    subscriptionPromise,
    about,
    contentFallback,
    children,
}: RepoPageBodyProps) {
    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-6">
                <div className="mb-4">
                    <RepoHeader
                        owner={owner}
                        repo={repo}
                        provider={provider}
                        repoDataPromise={repoDataPromise}
                        starredPromise={starredPromise}
                        subscriptionPromise={subscriptionPromise}
                    />
                </div>

                <div className="flex gap-8">
                    <div className="min-w-0 flex-1">
                        <Async
                            promise={repoDataPromise}
                            fallback={contentFallback}
                        >
                            {children}
                        </Async>
                    </div>

                    <Async
                        promise={Promise.all([
                            repoDataPromise,
                            about.contributorsPromise,
                            about.languagesPromise,
                            about.deploymentsPromise,
                            about.latestReleasePromise,
                            docFileNamesPromise,
                        ])}
                        fallback={<RepoSidebarSkeleton />}
                    >
                        {([
                            repoData,
                            contributors,
                            languages,
                            deployments,
                            latestRelease,
                            docFileNames,
                        ]) => (
                            <RepoSidebar
                                owner={owner}
                                repo={repo}
                                provider={provider}
                                description={repoData.description}
                                homepage={repoData.homepage}
                                topics={repoData.topics}
                                createdAt={repoData.createdAt}
                                contributors={contributors}
                                docFileNames={docFileNames}
                                languages={languages}
                                deployments={deployments}
                                latestRelease={latestRelease}
                            />
                        )}
                    </Async>
                </div>
            </div>
        </main>
    );
}
