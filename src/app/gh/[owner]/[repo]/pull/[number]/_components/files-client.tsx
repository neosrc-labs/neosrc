"use client";

import { MessageSquare, MessageSquareOff, RefreshCw } from "lucide-react";
import Image from "next/image";
import {
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
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
    PullRequestFile,
    PullsGetResponseData,
    ReviewComment,
} from "~/server/github";
import { api } from "~/trpc/react";
import { filenameHash } from "~/utils/filename-hash";
import { EMPTY_ARRAY_PROMISE } from "~/utils/promise";
import { getStoredSet, getViewedKey } from "~/utils/viewed-files";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { ActionSection } from "./action-section/actions-section";
import { AdditionsDeletionsBadge } from "./additions-deletions-badge";
import { Branches } from "./description";
import { StackBadge } from "./stack-popover";

// Files within this many pixels of the viewport render their full diff;
// farther files show the plain-text shell.
const VIEWPORT_MARGIN = 1600;

// Resolve which file (by index into `files`) a URL hash targets, if any.
// Handles file anchors (id = filename with "/" replaced by "-"), diff
// permalinks (#diff-<filenameHash>...) and review threads.
function resolveHashTargetIndex(
    files: PullRequestFile[],
    comments: ReviewComment[],
    hash: string,
): number {
    if (hash.startsWith("#review-thread-")) {
        const threadId = Number(hash.slice("#review-thread-".length));
        const comment = comments.find((c) => c.id === threadId);
        if (comment) {
            return files.findIndex((f) => f.filename === comment.path);
        }
        return -1;
    }
    if (hash.startsWith("#diff-")) {
        const fileHash = hash.match(/^#diff-([0-9a-f]{64})/)?.[1];
        if (fileHash) {
            return files.findIndex(
                (f) => filenameHash(f.filename) === fileHash,
            );
        }
        return -1;
    }
    return files.findIndex(
        (f) => f.filename.replace(/\//g, "-") === hash.slice(1),
    );
}

// Lightweight stand-in for files far from the viewport. Keeps the file's
// full patch text in the DOM so find-on-page sees it, at roughly the height
// the real diff will occupy, without mounting FileDiff — the diff rows,
// comment actions and syntax highlighting are the page's main render cost.
// FilesSection swaps in the full FileDiff once the file scrolls near the
// viewport.
function PlainDiffShell({ file }: { file: PullRequestFile }) {
    const statusColor =
        file.status === "added"
            ? "text-green-600"
            : file.status === "removed"
              ? "text-red-600"
              : file.status === "renamed"
                ? "text-blue-600"
                : "text-yellow-600";
    return (
        <div className="rounded border border-border">
            <div className="flex items-center gap-2 rounded-t border-border border-b bg-surface-secondary px-4 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-text-primary text-xs">
                    {file.filename}
                </span>
                <span className={`font-medium text-xs ${statusColor}`}>
                    {file.status}
                </span>
                {file.additions > 0 && (
                    <span className="font-medium text-green-600 text-xs">
                        +{file.additions}
                    </span>
                )}
                {file.deletions > 0 && (
                    <span className="font-medium text-red-600 text-xs">
                        -{file.deletions}
                    </span>
                )}
            </div>
            <div className="overflow-x-auto bg-surface">
                <pre className="whitespace-pre px-4 py-3 font-mono text-[13px] text-text-primary leading-[20px]">
                    {file.patch ?? ""}
                </pre>
            </div>
        </div>
    );
}

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

// One file's row on the changes page: the anchor wrapper plus either the
// full FileDiff (files near the viewport) or the plain-text shell (files far
// away). Memoized so unrelated state changes (comment queries resolving, the
// visibility seed, etc.) do not re-render all rows — on a PR with many files
// that is the dominant render cost.
const FileDiffRow = memo(function FileDiffRow({
    file,
    comments,
    isVisible,
    isOverflow,
    showComments,
    showPerformanceDiff,
    pendingReviewId,
    permissionContext,
    baseSha,
    headSha,
    owner,
    repo,
    number,
    onTogglePerformanceDiff,
}: {
    file: PullRequestFile;
    comments: ReviewComment[] | undefined;
    isVisible: boolean;
    isOverflow: boolean;
    showComments: boolean;
    showPerformanceDiff: boolean;
    pendingReviewId: number | null;
    permissionContext: PullRequestPermissionContext;
    baseSha: string;
    headSha?: string;
    owner: string;
    repo: string;
    number: string;
    onTogglePerformanceDiff: (filename: string) => void;
}) {
    return (
        <div
            id={file.filename.replace(/\//g, "-")}
            className="scroll-mt-18"
            data-filename={file.filename}
            style={{ contentVisibility: "auto" }}
        >
            {isVisible ? (
                <FileDiff
                    baseSha={baseSha}
                    headSha={headSha}
                    comments={comments ?? []}
                    file={file}
                    number={number}
                    onTogglePerformanceDiff={() =>
                        onTogglePerformanceDiff(file.filename)
                    }
                    owner={owner}
                    pendingReviewId={pendingReviewId}
                    permissionContext={permissionContext}
                    performanceHidden={isOverflow}
                    repo={repo}
                    showComments={showComments}
                    showPerformanceDiff={showPerformanceDiff}
                />
            ) : (
                <PlainDiffShell file={file} />
            )}
        </div>
    );
});

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

    // Files far from the viewport render as PlainDiffShell (their patch as
    // plain text): every file stays in the DOM so find-on-page sees it, the
    // page keeps its full height, and the expensive diff rows + syntax
    // highlighting are deferred until the file scrolls near. Files are never
    // removed from the set once visible, so there is no re-render churn
    // while scrolling back up.
    const [visibleFiles, setVisibleFiles] = useState<Set<string>>(
        () => new Set(),
    );

    // Synchronously seed the set with files already near the viewport so the
    // first paint shows full diffs (no plain-text flash), then let the
    // IntersectionObserver below take over. useLayoutEffect so the seed
    // lands in the same commit as the first render of the file list.
    useLayoutEffect(() => {
        if (allFiles.length === 0) return;
        const visible = new Set<string>();
        for (const el of document.querySelectorAll<HTMLElement>(
            "div.scroll-mt-18",
        )) {
            const filename = el.dataset.filename;
            if (!filename) continue;
            const rect = el.getBoundingClientRect();
            if (
                rect.top < window.innerHeight + VIEWPORT_MARGIN &&
                rect.bottom > -VIEWPORT_MARGIN
            ) {
                visible.add(filename);
            }
        }
        setVisibleFiles((prev) =>
            prev.size === visible.size ? prev : visible,
        );
    }, [allFiles]);

    useEffect(() => {
        if (allFiles.length === 0) return;
        const elements =
            document.querySelectorAll<HTMLElement>("div.scroll-mt-18");
        if (elements.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                let changed = false;
                for (const entry of entries) {
                    const filename = (entry.target as HTMLElement).dataset
                        .filename;
                    if (filename && entry.isIntersecting) changed = true;
                }
                if (!changed) return;
                setVisibleFiles((prev) => {
                    const next = new Set(prev);
                    for (const entry of entries) {
                        const filename = (entry.target as HTMLElement).dataset
                            .filename;
                        if (filename && entry.isIntersecting) {
                            next.add(filename);
                        }
                    }
                    return next;
                });
            },
            { rootMargin: `${VIEWPORT_MARGIN}px 0px` },
        );
        elements.forEach((el) => {
            observer.observe(el);
        });
        return () => observer.disconnect();
    }, [allFiles]);

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

    // Stable per-file comment arrays so the memoized FileDiffRow only
    // re-renders when its own file's comments change.
    const commentsByFile = useMemo(() => {
        const map = new Map<string, ReviewComment[]>();
        for (const comment of allCommentsAll) {
            const list = map.get(comment.path);
            if (list) {
                list.push(comment);
            } else {
                map.set(comment.path, [comment]);
            }
        }
        return map;
    }, [allCommentsAll]);

    const pendingReviewId = pendingReview?.reviewId ?? null;

    // A URL hash can point at a file that is not near the viewport (deep
    // permalinks, review threads). Force that file visible so its full diff
    // (and the anchor element inside it) exists before the scroll effects
    // below run.
    useEffect(() => {
        if (allFiles.length === 0) return;
        const hash = window.location.hash;
        if (!hash) return;
        const targetIndex = resolveHashTargetIndex(
            allFiles,
            allCommentsAll,
            hash,
        );
        if (targetIndex < 0) return;
        const target = allFiles[targetIndex];
        if (!target) return;
        setVisibleFiles((prev) => {
            if (prev.has(target.filename)) return prev;
            const next = new Set(prev);
            next.add(target.filename);
            return next;
        });
    }, [allFiles, allCommentsAll]);

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
                                    const totalChanged =
                                        file.additions + file.deletions;
                                    const isOverflow =
                                        index >= OVERFLOW_THRESHOLD ||
                                        file.status === "removed" ||
                                        totalChanged > 1000;
                                    return (
                                        <FileDiffRow
                                            key={file.filename}
                                            baseSha={pullRequest.base.sha}
                                            comments={commentsByFile.get(
                                                file.filename,
                                            )}
                                            file={file}
                                            headSha={
                                                pullRequest.head.sha ??
                                                commitSha
                                            }
                                            isOverflow={isOverflow}
                                            isVisible={visibleFiles.has(
                                                file.filename,
                                            )}
                                            number={number.toString()}
                                            onTogglePerformanceDiff={
                                                toggleOverflowFile
                                            }
                                            owner={owner}
                                            pendingReviewId={pendingReviewId}
                                            permissionContext={
                                                permissionContext
                                            }
                                            repo={repo}
                                            showComments={showComments}
                                            showPerformanceDiff={expandedOverflowFiles.has(
                                                file.filename,
                                            )}
                                        />
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
