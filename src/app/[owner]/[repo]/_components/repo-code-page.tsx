"use client";

import { Async } from "~/components/async";
import { RepoDocFiles, RepoDocFilesSkeleton } from "./repo-doc-files";
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
    isFork: boolean;
    parentFullName: string | null;
    parentDefaultBranch: string | null;
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

type Provider = "gh" | "cb";

interface RepoCodePageProps {
    owner: string;
    repo: string;
    provider: Provider;
    repoDataPromise: Promise<RepoData>;
    contributorsPromise: Promise<Contributor[]>;
    docFileNamesPromise: Promise<DocFileName[]>;
    languagesPromise: Promise<Record<string, number>>;
    deploymentsPromise: Promise<Deployment[]>;
    latestReleasePromise: Promise<{
        name: string;
        tagName: string;
        createdAt: string;
        htmlUrl: string;
    } | null>;
    starredPromise: Promise<boolean>;
    subscriptionPromise: Promise<{
        subscribed: boolean;
        ignored: boolean;
    } | null>;
}

export function RepoCodePage({
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
}: RepoCodePageProps) {
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
                            fallback={
                                <RepoFileTableSkeleton
                                    owner={owner}
                                    repo={repo}
                                />
                            }
                        >
                            {(repoData) => (
                                <RepoFileTable
                                    owner={owner}
                                    repo={repo}
                                    provider={provider}
                                    defaultBranch={repoData.defaultBranch}
                                    isFork={repoData.isFork}
                                    parentFullName={repoData.parentFullName}
                                    parentDefaultBranch={
                                        repoData.parentDefaultBranch
                                    }
                                />
                            )}
                        </Async>

                        <Async
                            promise={Promise.all([
                                repoDataPromise,
                                docFileNamesPromise,
                            ])}
                            fallback={<RepoDocFilesSkeleton />}
                        >
                            {([repoData, docFileNames]) => (
                                <RepoDocFiles
                                    owner={owner}
                                    repo={repo}
                                    ref={repoData.defaultBranch}
                                    fileNames={docFileNames}
                                    provider={provider}
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
