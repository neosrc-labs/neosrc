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
 * Header, content column and sidebar shell shared by the repo code, tree and
 * blob views. Only the middle column differs between them.
 */
export function RepoPageBody({
    owner,
    repo,
    provider,
    repoDataPromise,
    contributorsPromise,
    docFileNamesPromise,
    languagesPromise,
    deploymentsPromise,
    latestReleasePromise,
    starredPromise,
    subscriptionPromise,
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
                            contributorsPromise,
                            docFileNamesPromise,
                            languagesPromise,
                            deploymentsPromise,
                            latestReleasePromise,
                        ])}
                        fallback={<RepoSidebarSkeleton />}
                    >
                        {([
                            repoData,
                            contributors,
                            docFileNames,
                            languages,
                            deployments,
                            latestRelease,
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
