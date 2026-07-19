"use client";

import type { RouterOutputs } from "~/trpc/react";

import { api } from "~/trpc/react";
import { RepoHeader } from "./repo-header";

type RepoData = Extract<
    RouterOutputs["repos"]["getByOwnerAndRepo"],
    { description: string }
>;

interface RepoCodePageProps {
    owner: string;
    repo: string;
}

export function RepoCodePage({ owner, repo }: RepoCodePageProps) {
    const { data: raw, isLoading } = api.repos.getByOwnerAndRepo.useQuery({
        provider: "gh",
        owner,
        repo,
    });

    const repoData = raw as RepoData | undefined;

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    {isLoading || !repoData ? (
                        <div className="space-y-3">
                            <div className="h-8 w-64 animate-pulse rounded bg-surface-secondary" />
                            <div className="h-4 w-96 animate-pulse rounded bg-surface-secondary" />
                        </div>
                    ) : (
                        <RepoHeader
                            owner={owner}
                            repo={repo}
                            ownerAvatarUrl={repoData.ownerAvatarUrl}
                            isPrivate={repoData.isPrivate}
                            stars={repoData.stars}
                            forks={repoData.forks}
                            watchers={repoData.watchers}
                        />
                    )}
                </div>

                <div className="flex gap-8">
                    <div className="min-w-0 flex-1">
                        {/* File table area */}
                        <div className="rounded-xl border border-border bg-surface">
                            <div className="flex items-center gap-4 border-border border-b px-4 py-3">
                                <div className="h-5 w-32 animate-pulse rounded bg-surface-secondary" />
                            </div>
                            <div className="p-4">
                                <div className="space-y-2">
                                    {["f1", "f2", "f3", "f4", "f5"].map(
                                        (key) => (
                                            <div
                                                key={key}
                                                className="h-6 animate-pulse rounded bg-surface-secondary"
                                            />
                                        ),
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* README placeholder */}
                        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
                            <div className="h-4 w-24 animate-pulse rounded bg-surface-secondary" />
                            <div className="mt-4 space-y-2">
                                <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                                <div className="h-3 w-3/4 animate-pulse rounded bg-surface-secondary" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-secondary" />
                            </div>
                        </div>
                    </div>

                    {/* Right sidebar metadata */}
                    <aside className="w-72 shrink-0">
                        <div className="rounded-xl border border-border bg-surface p-6">
                            <h2 className="mb-4 font-semibold text-sm text-text-secondary uppercase">
                                About
                            </h2>
                            <div className="space-y-2">
                                <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                                <div className="h-3 w-2/3 animate-pulse rounded bg-surface-secondary" />
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}
