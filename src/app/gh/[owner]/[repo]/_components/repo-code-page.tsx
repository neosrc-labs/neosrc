"use client";

import { Async } from "~/components/async";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoFileTable, RepoFileTableSkeleton } from "./repo-file-table";
import { RepoHeader } from "./repo-header";
import { RepoSidebar, RepoSidebarSkeleton } from "./repo-sidebar";

export interface RepoData {
    ownerAvatarUrl: string;
    isPrivate: boolean;
    stars: number;
    forks: number;
    watchers: number;
    description: string;
    defaultBranch: string;
    homepage: string | null;
    language: string | null;
    topics: string[];
    license: { spdxId: string | null; name: string; url: string | null } | null;
    createdAt: string;
}

interface Contributor {
    login: string;
    avatarUrl: string;
}

export interface DocFileName {
    name: string;
    path: string;
    displayName: string;
}

interface Deployment {
    id: number;
    environment: string;
    state: string;
    createdAt: string;
}

interface RepoCodePageProps {
    owner: string;
    repo: string;
    repoDataPromise: Promise<RepoData>;
    contributorsPromise: Promise<Contributor[]>;
    docFileNamesPromise: Promise<DocFileName[]>;
    languagesPromise: Promise<Record<string, number>>;
    deploymentsPromise: Promise<Deployment[]>;
    starredPromise: Promise<boolean>;
    subscriptionPromise: Promise<{
        subscribed: boolean;
        ignored: boolean;
    } | null>;
}

export function RepoCodePage({
    owner,
    repo,
    repoDataPromise,
    contributorsPromise,
    docFileNamesPromise,
    languagesPromise,
    deploymentsPromise,
    starredPromise,
    subscriptionPromise,
}: RepoCodePageProps) {
    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-6">
                <div className="mb-4">
                    <RepoHeader
                        owner={owner}
                        repo={repo}
                        repoDataPromise={repoDataPromise}
                        starredPromise={starredPromise}
                        subscriptionPromise={subscriptionPromise}
                    />
                </div>

                <div className="flex gap-8">
                    <div className="min-w-0 flex-1">
                        <Async
                            promise={repoDataPromise}
                            fallback={<RepoFileTableSkeleton />}
                        >
                            {(repoData) => (
                                <RepoFileTable
                                    owner={owner}
                                    repo={repo}
                                    defaultBranch={repoData.defaultBranch}
                                />
                            )}
                        </Async>

                        <Async promise={repoDataPromise} fallback={null}>
                            {(repoData) => (
                                <RepoDocFiles
                                    owner={owner}
                                    repo={repo}
                                    ref={repoData.defaultBranch}
                                />
                            )}
                        </Async>
                    </div>

                    <Async
                        promise={Promise.all([
                            repoDataPromise,
                            contributorsPromise,
                            docFileNamesPromise,
                            languagesPromise,
                            deploymentsPromise,
                        ])}
                        fallback={<RepoSidebarSkeleton />}
                    >
                        {([
                            repoData,
                            contributors,
                            docFileNames,
                            languages,
                            deployments,
                        ]) => (
                            <RepoSidebar
                                owner={owner}
                                repo={repo}
                                description={repoData.description}
                                homepage={repoData.homepage}
                                topics={repoData.topics}
                                createdAt={repoData.createdAt}
                                contributors={contributors}
                                docFileNames={docFileNames}
                                languages={languages}
                                deployments={deployments}
                            />
                        )}
                    </Async>
                </div>
            </div>
        </main>
    );
}
