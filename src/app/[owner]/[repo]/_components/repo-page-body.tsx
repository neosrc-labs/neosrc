"use client";

import type { ReactNode } from "react";
import { Async } from "~/components/async";
import { cn } from "~/lib/utils";
import type { Provider } from "~/utils/provider-url";
import { RepoHeader } from "./repo-header";
import type { RepoAboutData, RepoData, RepoPageData } from "./repo-page-types";
import { RepoSidebar, RepoSidebarSkeleton } from "./repo-sidebar";

interface RepoPageBodyProps {
    owner: string;
    repo: string;
    provider: Provider;
    repoDataPromise: Promise<RepoData>;
    docFileNamesPromise: RepoPageData["docFileNamesPromise"];
    starredPromise: RepoPageData["starredPromise"];
    subscriptionPromise: RepoPageData["subscriptionPromise"];
    /** About column data; omitted by views that do not render the column. */
    about?: RepoAboutData;
    /**
     * Renders the body inside a layout that already supplies the main column
     * and its border, e.g. the resizable file browser shell.
     */
    embedded?: boolean;
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
    docFileNamesPromise,
    starredPromise,
    subscriptionPromise,
    about,
    embedded = false,
    contentFallback,
    children,
}: RepoPageBodyProps) {
    const content = (
        <div
            className={cn(
                "mx-auto max-w-7xl px-6 py-6",
                embedded && "min-h-[calc(100svh-var(--header-height))]",
            )}
        >
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
                    <Async promise={repoDataPromise} fallback={contentFallback}>
                        {children}
                    </Async>
                </div>

                {about && (
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
                )}
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            {content}
        </main>
    );
}
