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

interface RepoCodePageProps {
    owner: string;
    repo: string;
    repoDataPromise: Promise<RepoData>;
    contributorsPromise: Promise<Contributor[]>;
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
                        promise={combine(repoDataPromise, contributorsPromise)}
                        fallback={<RepoSidebarSkeleton />}
                    >
                        {([repoData, contributors]) => (
                            <RepoSidebar
                                owner={owner}
                                repo={repo}
                                description={repoData.description}
                                homepage={repoData.homepage}
                                language={repoData.language}
                                topics={repoData.topics}
                                license={repoData.license}
                                createdAt={repoData.createdAt}
                                contributors={contributors}
                            />
                        )}
                    </Async>
                </div>
            </div>
        </main>
    );
}

function combine<A, B>(a: Promise<A>, b: Promise<B>): Promise<[A, B]> {
    return Promise.all([a, b]);
}
