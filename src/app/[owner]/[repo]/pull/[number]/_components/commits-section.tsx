"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { Async, AsyncLink } from "~/components/async";
import { CommitHoverCard } from "~/components/hovercards/commit-hover-card";
import type { Commit, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

const COMMIT_ITEM_HEIGHT = 52;

interface CommitsSectionProps {
    pullRequestPromise: Promise<PullsGetResponseData>;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    owner: string;
    repo: string;
    number: number;
}

export function CommitsSection({
    pullRequestPromise,
    scrollRef,
    owner,
    repo,
    number,
}: CommitsSectionProps) {
    const pathname = usePathname();
    const currentSha =
        pathname?.match(/\/files\/([a-f0-9]{7,40})/)?.[1] ?? null;

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.commits.listForPullRequest.useInfiniteQuery(
            { owner, repo, number },
            {
                getNextPageParam: (lastPage) => lastPage.nextPage,
            },
        );

    const commits = useMemo(
        () => data?.pages.flatMap((page) => page.commits) ?? [],
        [data],
    );

    return (
        <>
            {isLoading ? (
                <CommitsSkeleton />
            ) : commits.length === 0 ? (
                <p className="text-gray-500 text-sm dark:text-gray-400">
                    No commits
                </p>
            ) : (
                <Async
                    fallback={<CommitsSkeleton />}
                    promise={pullRequestPromise}
                >
                    {(pullRequest) => (
                        <CommitsList
                            commits={commits}
                            currentSha={currentSha}
                            pullRequest={pullRequest}
                            scrollRef={scrollRef}
                            hasNextPage={hasNextPage ?? false}
                            fetchNextPage={fetchNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                        />
                    )}
                </Async>
            )}
        </>
    );
}

interface CommitsListProps {
    commits: Commit[];
    pullRequest: PullsGetResponseData;
    currentSha: string | null;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    hasNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    isFetchingNextPage: boolean;
}

function CommitsList({
    commits,
    pullRequest,
    currentSha,
    scrollRef,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
}: CommitsListProps) {
    const virtualizer = useVirtualizer({
        count: commits.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => COMMIT_ITEM_HEIGHT,
        overscan: 5,
    });

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        const scrollEl = scrollRef.current;
        if (!el || !scrollEl || !hasNextPage) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { root: scrollEl, rootMargin: "400px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasNextPage, fetchNextPage, scrollRef]);

    const baseUrl = `/${pullRequest.base.repo.owner.login}/${pullRequest.base.repo.name}/pull/${pullRequest.number}/files`;

    return (
        <>
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const commit = commits[virtualItem.index];
                    if (!commit) return null;
                    const isCurrent = currentSha
                        ? commit.sha.startsWith(currentSha)
                        : false;
                    return (
                        <div
                            key={virtualItem.key}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <CommitHoverCard baseUrl={baseUrl} commit={commit}>
                                <AsyncLink
                                    className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                                        isCurrent
                                            ? "border-blue-500 border-l-2 bg-blue-50 dark:bg-blue-950"
                                            : ""
                                    }`}
                                    href={`${baseUrl}/${commit.sha}`}
                                >
                                    {commit.author && (
                                        <img
                                            alt={commit.author.login}
                                            className="mt-0.5 h-5 w-5 shrink-0 rounded-full"
                                            src={commit.author.avatar_url}
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
                                            {
                                                commit.commit.message.split(
                                                    "\n",
                                                )[0]
                                            }
                                        </p>
                                        {commit.author &&
                                            commit.commit.committer && (
                                                <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
                                                    {commit.author.login}{" "}
                                                    committed{" "}
                                                    {formatRelativeTime(
                                                        commit.commit.committer
                                                            .date ?? "",
                                                    )}
                                                </p>
                                            )}
                                    </div>
                                </AsyncLink>
                            </CommitHoverCard>
                        </div>
                    );
                })}
            </div>
            {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}
            {isFetchingNextPage && (
                <p className="py-2 text-center text-gray-500 text-xs dark:text-gray-400">
                    Loading more commits...
                </p>
            )}
        </>
    );
}

function CommitsSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => i).map((i) => (
                <div
                    className="flex items-start gap-2"
                    key={`commit-skeleton-${i}`}
                >
                    <div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-gray-200" />
                    <div className="min-w-0 flex-1">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                        <div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    </div>
                </div>
            ))}
        </div>
    );
}
