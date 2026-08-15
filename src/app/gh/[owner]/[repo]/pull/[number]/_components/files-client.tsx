"use client";

import { MessageSquare, MessageSquareOff, RefreshCw } from "lucide-react";
import Image from "next/image";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Async } from "~/components/async";
import FileDiff from "~/components/file-diff";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import {
    extractPullRequestState,
    StatusPill,
} from "~/components/ui/status-pill";
import { useFiles } from "~/hooks/files";
import type {
    CheckRun,
    PullsGetResponseData,
    ReviewComment,
} from "~/server/github";
import { api } from "~/trpc/react";
import { EMPTY_ARRAY_PROMISE } from "~/utils/promise";
import { getStoredSet, getViewedKey } from "~/utils/viewed-files";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { ActionSection } from "./action-section/actions-section";
import { AdditionsDeletionsBadge } from "./additions-deletions-badge";
import { Branches } from "./description";
import { StackBadge } from "./stack-popover";

function FileDiffSkeleton() {
    return (
        <div className="mb-6 overflow-hidden rounded border border-border">
            <div className="flex items-center gap-2 border-border border-b bg-surface-secondary px-4 py-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-selected" />
            </div>
            <div className="bg-surface p-5">
                <div className="space-y-2">
                    <div className="h-4 w-5/6 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-3/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-surface-tertiary" />
                </div>
            </div>
        </div>
    );
}

interface FilesSectionProps {
    owner: string;
    repo: string;
    number: number;
    commitSha?: string;
    pullRequestPromise: Promise<PullsGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    conflictedFilesPromise?: Promise<string[]> | null;
    checkRunsPromise?: Promise<CheckRun[]> | null;
    children?: ReactNode;
}

export function FilesSection({
    owner,
    repo,
    number,
    commitSha,
    pullRequestPromise,
    permissionContextPromise,
    conflictedFilesPromise,
    checkRunsPromise,
    children,
}: FilesSectionProps) {
    const [showComments, setShowComments] = useState(true);
    const [expandedOverflowFiles, setExpandedOverflowFiles] = useState(
        () => new Set<string>(),
    );
    const heightMapRef = useRef(new Map<string, number>());
    const { files: allFiles, isLoading } = useFiles({
        owner,
        repo,
        number,
        commitSha,
    });

    // Poll the PR head so we can detect pushes made after the page rendered.
    const { data: currentHeadSha } = api.pulls.headSha.useQuery(
        { owner, repo, number },
        { refetchInterval: 15_000 },
    );

    const handleRefresh = useCallback(() => {
        window.location.href = `/gh/${owner}/${repo}/pull/${number}/changes`;
    }, [owner, repo, number]);

    const [viewedCount, setViewedCount] = useState(0);

    useEffect(() => {
        const key = getViewedKey(owner, repo, number);
        const viewed = getStoredSet(key);
        setViewedCount(allFiles.filter((f) => viewed.has(f.filename)).length);
    }, [allFiles, owner, repo, number]);

    useEffect(() => {
        const handler = () => {
            const key = getViewedKey(owner, repo, number);
            const viewed = getStoredSet(key);
            setViewedCount(
                allFiles.filter((f) => viewed.has(f.filename)).length,
            );
        };
        window.addEventListener("file-viewed-changed", handler);
        return () => window.removeEventListener("file-viewed-changed", handler);
    }, [allFiles, owner, repo, number]);

    const OVERFLOW_THRESHOLD = 200;

    const { data: allComments = [] } = api.reviewComments.list.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const allCommentsAll = useMemo((): ReviewComment[] => {
        const submitted = allComments;
        const pending = (pendingReview?.comments ?? []) as ReviewComment[];
        return [...submitted, ...pending];
    }, [allComments, pendingReview]);

    const pendingReviewId = pendingReview?.reviewId ?? null;

    const toggleOverflowFile = useCallback((filename: string) => {
        setExpandedOverflowFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (allFiles.length <= OVERFLOW_THRESHOLD) return;
        const firstOverflow = allFiles[OVERFLOW_THRESHOLD];
        if (!firstOverflow) return;
        const measuredHeight = heightMapRef.current.get(firstOverflow.filename);
        if (measuredHeight === undefined) return;
        for (let i = OVERFLOW_THRESHOLD; i < allFiles.length; i++) {
            const file = allFiles[i];
            if (!file) continue;
            const key = file.filename;
            if (!heightMapRef.current.has(key)) {
                heightMapRef.current.set(key, measuredHeight);
            }
        }
    }, [allFiles]);

    useEffect(() => {
        if (allCommentsAll.length === 0) return;
        const hash = window.location.hash;
        if (hash.startsWith("#review-thread-")) {
            const id = hash.slice(1);
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [allCommentsAll]);

    useEffect(() => {
        if (allFiles.length === 0) return;
        const hash = window.location.hash;
        if (!hash || hash.startsWith("#review-thread-")) return;
        const el = document.getElementById(hash.slice(1));
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [allFiles]);

    return (
        <div>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-surface py-2 pr-2">
                <div className="min-w-0">
                    <Async promise={pullRequestPromise} fallback={null}>
                        {(pullRequest) => {
                            if (!pullRequest.title) return null;

                            return (
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <StatusPill
                                            size="xs"
                                            state={extractPullRequestState(
                                                pullRequest,
                                            )}
                                        />
                                        <h2 className="truncate font-semibold text-base text-text-primary">
                                            <CodeTitle
                                                provider="gh"
                                                owner={owner}
                                                repo={repo}
                                            >
                                                {pullRequest.title}
                                            </CodeTitle>
                                        </h2>
                                    </div>
                                </div>
                            );
                        }}
                    </Async>
                    <div className="mt-1 flex items-center gap-3 text-text-secondary text-xs">
                        <Async promise={pullRequestPromise} fallback={null}>
                            {(pullRequest) => {
                                const user = pullRequest.user;
                                const baseRef = pullRequest.base?.ref;
                                const headRef = pullRequest.head?.ref;
                                return (
                                    <>
                                        {user?.login ? (
                                            <UserHoverCard login={user.login}>
                                                <a
                                                    className="flex items-center gap-2"
                                                    href={user.html_url}
                                                >
                                                    <Image
                                                        alt={user.login}
                                                        className="h-4 w-4 rounded-full"
                                                        src={user.avatar_url}
                                                        width={16}
                                                        height={16}
                                                    />
                                                    {user.login}
                                                </a>
                                            </UserHoverCard>
                                        ) : null}
                                        {baseRef && headRef ? (
                                            <Branches
                                                owner={owner}
                                                repo={repo}
                                                pullRequest={pullRequest}
                                            />
                                        ) : null}
                                        {pullRequest.stack ? (
                                            <StackBadge
                                                owner={owner}
                                                repo={repo}
                                                prNumber={pullRequest.number}
                                                stack={pullRequest.stack}
                                                isLinkToChanges={true}
                                            />
                                        ) : null}
                                    </>
                                );
                            }}
                        </Async>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <Async promise={pullRequestPromise}>
                        {(pullRequest) => {
                            const isOutdated =
                                !commitSha &&
                                pullRequest.head?.sha !== undefined &&
                                currentHeadSha?.headSha !== undefined &&
                                pullRequest.head.sha !== currentHeadSha.headSha;

                            return (
                                <>
                                    {isOutdated && (
                                        <button
                                            type="button"
                                            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 font-medium text-sm text-white ring-1 ring-orange-700 transition-colors hover:bg-orange-700"
                                            onClick={handleRefresh}
                                            title="Refresh to view the latest changes"
                                        >
                                            <RefreshCw size={14} />
                                            Refresh
                                        </button>
                                    )}
                                    <AdditionsDeletionsBadge
                                        additions={pullRequest.additions}
                                        deletions={pullRequest.deletions}
                                    />
                                </>
                            );
                        }}
                    </Async>
                    {allFiles.length > 0 && (
                        <div className="flex flex-col gap-0.5 text-text-secondary text-xs">
                            <div className="flex items-center gap-1.5">
                                <span>
                                    {viewedCount}/{allFiles.length} files viewed
                                </span>
                            </div>
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-selected">
                                <div
                                    className="h-full rounded-full bg-blue-400 transition-all"
                                    style={{
                                        width: `${
                                            allFiles.length > 0
                                                ? (
                                                      viewedCount /
                                                          allFiles.length
                                                  ) * 100
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    <button
                        className="flex cursor-pointer items-center gap-2 rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                        onClick={() => setShowComments(!showComments)}
                        title={showComments ? "Hide comments" : "Show comments"}
                        type="button"
                    >
                        {showComments ? (
                            <MessageSquare size={16} />
                        ) : (
                            <MessageSquareOff size={16} />
                        )}
                        <span className="font-mono text-xs leading-none">
                            {allCommentsAll.length}
                        </span>
                    </button>
                    <Async
                        fallback={null}
                        promise={checkRunsPromise ?? EMPTY_ARRAY_PROMISE}
                    >
                        {(checkRuns) => (
                            <ActionSection
                                variant="inline"
                                owner={owner}
                                repo={repo}
                                number={number}
                                pullRequestPromise={pullRequestPromise}
                                conflictedFilesPromise={conflictedFilesPromise}
                                permissionContextPromise={
                                    permissionContextPromise
                                }
                                checkRuns={checkRuns}
                            />
                        )}
                    </Async>
                </div>
            </div>
            {children}
            {isLoading && allFiles.length === 0 && (
                <>
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                </>
            )}
            <Async promise={pullRequestPromise}>
                {(pullRequest) => (
                    <Async promise={permissionContextPromise}>
                        {(permissionContext) => (
                            <div className="flex flex-col gap-6">
                                {allFiles.map((file, index) => {
                                    const fileComments = allCommentsAll.filter(
                                        (c) => c.path === file.filename,
                                    );
                                    const totalChanged =
                                        file.additions + file.deletions;
                                    const isOverflow =
                                        index >= OVERFLOW_THRESHOLD ||
                                        file.status === "removed" ||
                                        totalChanged > 1000;

                                    return (
                                        <div
                                            key={file.filename}
                                            id={file.filename.replace(
                                                /\//g,
                                                "-",
                                            )}
                                            className="scroll-mt-18"
                                            style={{
                                                contentVisibility: "auto",
                                            }}
                                        >
                                            <FileDiff
                                                baseSha={pullRequest.base.sha}
                                                headSha={
                                                    pullRequest.head.sha ??
                                                    commitSha
                                                }
                                                comments={fileComments}
                                                file={file}
                                                number={number.toString()}
                                                onTogglePerformanceDiff={() =>
                                                    toggleOverflowFile(
                                                        file.filename,
                                                    )
                                                }
                                                owner={owner}
                                                pendingReviewId={
                                                    pendingReviewId
                                                }
                                                permissionContext={
                                                    permissionContext
                                                }
                                                performanceHidden={isOverflow}
                                                repo={repo}
                                                showComments={showComments}
                                                showPerformanceDiff={expandedOverflowFiles.has(
                                                    file.filename,
                                                )}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Async>
                )}
            </Async>
        </div>
    );
}
