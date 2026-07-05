"use client";

import { FoldVertical, MessageSquare, UnfoldVertical } from "lucide-react";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import type { ReviewComment } from "~/server/github";

function isFileLevelComment(c: ReviewComment): boolean {
    const maybe = c as Record<string, unknown>;
    return (
        maybe.subject_type === "file" || (c.line == null && c.position == null)
    );
}

function isLineComment(c: ReviewComment): boolean {
    return !isFileLevelComment(c);
}

import { api } from "~/trpc/react";
import { isGeneratedFile } from "~/utils/generated-files";
import { isImageFile } from "~/utils/image-file";
import { isSvgFile } from "~/utils/svg-file";
import { getStoredSet, getViewedKey, setStoredSet } from "~/utils/viewed-files";
import { type ActiveComment, DiffView, groupThreads } from "./DiffView";
import ImageDiff from "./ImageDiff";
import { InlineCommentThread } from "./InlineCommentThread";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import SvgDiff from "./SvgDiff";

interface FileDiffProps {
    file: {
        filename: string;
        patch?: string | null;
        status: string;
        additions: number;
        deletions: number;
        previous_filename?: string;
    };
    owner: string;
    repo: string;
    number: string;
    baseSha?: string;
    headSha?: string;
    comments?: ReviewComment[];
    showComments?: boolean;
    pendingReviewId?: number | null;
    showGeneratedDiff?: boolean;
    onToggleGeneratedDiff?: () => void;
    performanceHidden?: boolean;
    showPerformanceDiff?: boolean;
    onTogglePerformanceDiff?: () => void;
}

export default function FileDiff({
    file,
    owner,
    repo,
    number,
    baseSha,
    headSha,
    comments = [],
    showComments = true,
    pendingReviewId,
    showGeneratedDiff = false,
    onToggleGeneratedDiff,
    performanceHidden = false,
    showPerformanceDiff = true,
    onTogglePerformanceDiff,
}: FileDiffProps) {
    const [isViewed, setIsViewed] = useState(() => {
        if (typeof window === "undefined") return false;
        return getStoredSet(getViewedKey(owner, repo, number)).has(
            file.filename,
        );
    });
    const [isCollapsed, setIsCollapsed] = useState(isViewed);
    const [activeComment, setActiveComment] = useState<ActiveComment | null>(
        null,
    );
    const [commentBody, setCommentBody] = useState("");
    const [expandedAll, setExpandedAll] = useState(false);
    const recentlyAddedIds = useRef(new Set<number>());
    const utils = api.useUtils();
    const headerRef = useRef<HTMLDivElement>(null);

    const generated = isGeneratedFile(file.filename);

    const isImage = isImageFile(file.filename) && !file.patch && baseSha;

    const isSvg = isSvgFile(file.filename) && !!file.patch;

    const svgContentUrls = useMemo(() => {
        if (!isSvg) return null;
        const oldFilename = file.previous_filename ?? file.filename;
        const params = (sha: string, path: string) =>
            `/api/raw?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(path)}`;
        const newUrl =
            file.status !== "removed" && headSha
                ? params(headSha, file.filename)
                : null;
        const oldUrl =
            file.status !== "added" && baseSha
                ? params(baseSha, oldFilename)
                : null;
        return { oldUrl, newUrl };
    }, [
        isSvg,
        file.status,
        file.filename,
        file.previous_filename,
        owner,
        repo,
        baseSha,
        headSha,
    ]);

    const imageUrls = useMemo(() => {
        if (!isImage) return null;
        const oldFilename = file.previous_filename ?? file.filename;
        const params = (sha: string, path: string) =>
            `/api/raw?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(path)}`;
        const newUrl =
            file.status !== "removed" && headSha
                ? params(headSha, file.filename)
                : null;
        const oldUrl =
            file.status !== "added" && baseSha
                ? params(baseSha, oldFilename)
                : null;
        return { oldUrl, newUrl };
    }, [
        isImage,
        file.status,
        file.filename,
        file.previous_filename,
        owner,
        repo,
        baseSha,
        headSha,
    ]);

    const allFileLevelComments = useMemo(() => {
        return comments.filter(
            (c) => c.path === file.filename && isFileLevelComment(c),
        );
    }, [comments, file.filename]);

    const allLineComments = useMemo(() => {
        return comments.filter(isLineComment);
    }, [comments]);

    const fileLevelComments = useMemo(() => {
        if (showComments) return allFileLevelComments;
        return allFileLevelComments.filter((c) =>
            recentlyAddedIds.current.has(c.id),
        );
    }, [showComments, allFileLevelComments]);

    const lineComments = useMemo(() => {
        if (showComments) return allLineComments;
        return allLineComments.filter((c) =>
            recentlyAddedIds.current.has(c.id),
        );
    }, [showComments, allLineComments]);

    const effectiveShowComments =
        showComments || recentlyAddedIds.current.size > 0;

    const createMutation = api.reviewComments.create.useMutation({
        onSuccess: (data) => {
            setCommentBody("");
            setActiveComment(null);
            if (!showComments && data?.id) {
                recentlyAddedIds.current.add(data.id);
            }
            utils.reviewComments.list.invalidate();
            utils.reviews.getPending.invalidate();
        },
    });

    const startReviewMutation = api.reviews.start.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
        },
    });

    const handleAddComment = useCallback(
        (isReview: boolean) => {
            if (!commentBody.trim() || !activeComment) return;
            const args: Parameters<typeof createMutation.mutate>[0] = {
                owner,
                repo,
                number: Number(number),
                filePath: file.filename,
                body: commentBody,
                asReview: isReview,
                ...(activeComment.type === "line"
                    ? {
                          lineNumber: activeComment.line,
                          side: activeComment.side,
                          startLineNumber: activeComment.startLine,
                          startSide: activeComment.startSide,
                      }
                    : {}),
            };

            const doCreateComment = () => {
                createMutation.mutate(args);
            };

            if (isReview && !pendingReviewId) {
                startReviewMutation.mutate(
                    { owner, repo, number: Number(number) },
                    { onSuccess: doCreateComment },
                );
            } else {
                doCreateComment();
            }
        },
        [
            commentBody,
            activeComment,
            createMutation,
            startReviewMutation,
            pendingReviewId,
            owner,
            repo,
            number,
            file.filename,
        ],
    );

    const footerActions = pendingReviewId
        ? [
              {
                  label: "Add to Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ]
        : [
              {
                  label: "Add single comment",
                  onClick: () => handleAddComment(false),
                  variant: "neutral" as const,
                  disabled: (text: string) => !text.trim(),
              },
              {
                  label: "Start a Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ];

    const toggleCollapsed = () => {
        const willCollapse = !isCollapsed;
        const stickyOffset = 56;

        if (willCollapse && headerRef.current) {
            const headerTop = headerRef.current.getBoundingClientRect().top;
            if (Math.abs(headerTop - stickyOffset) < 20) {
                setIsCollapsed(true);
                setTimeout(() => {
                    if (headerRef.current) {
                        const newTop =
                            headerRef.current.getBoundingClientRect().top;
                        const delta = newTop - stickyOffset;
                        if (Math.abs(delta) > 1) {
                            window.scrollBy(0, delta);
                        }
                    }
                }, 0);
                return;
            }
        }
        setIsCollapsed(!isCollapsed);
    };

    const toggleExpandAll = () => {
        const willCollapse = expandedAll;
        if (willCollapse && headerRef.current) {
            const stickyOffset = 56;
            const headerTop = headerRef.current.getBoundingClientRect().top;
            if (Math.abs(headerTop - stickyOffset) < 20) {
                setExpandedAll(false);
                setTimeout(() => {
                    if (headerRef.current) {
                        const newTop =
                            headerRef.current.getBoundingClientRect().top;
                        const delta = newTop - stickyOffset;
                        if (Math.abs(delta) > 1) {
                            window.scrollBy(0, delta);
                        }
                    }
                }, 0);
                return;
            }
        }
        setExpandedAll(!expandedAll);
    };

    const toggleViewed = () => {
        const key = getViewedKey(owner, repo, number);
        const viewed = getStoredSet(key);
        if (isViewed) {
            viewed.delete(file.filename);
        } else {
            viewed.add(file.filename);
        }
        setStoredSet(key, viewed);
        setIsViewed(!isViewed);
        if (!isViewed && !isCollapsed) {
            toggleCollapsed();
        } else if (isViewed && isCollapsed) {
            toggleCollapsed();
        }
        window.dispatchEvent(new Event("file-viewed-changed"));
    };

    const statusColor =
        file.status === "added"
            ? "text-green-600"
            : file.status === "deleted"
              ? "text-red-600"
              : file.status === "renamed"
                ? "text-blue-600"
                : "text-yellow-600";

    return (
        <div className="rounded border border-gray-200 dark:border-zinc-700">
            <div
                ref={headerRef}
                className="sticky top-[56px] z-[1] flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
                <button
                    className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={toggleCollapsed}
                    type="button"
                >
                    <svg
                        className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <title>Toggle collapse</title>
                        <path
                            d="M19 9l-7 7-7-7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                        />
                    </svg>
                </button>

                <button
                    className="h-4 w-4 cursor-pointer text-gray-500 dark:text-gray-400"
                    onClick={toggleCollapsed}
                    type="button"
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <title>File</title>
                        <path
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                        />
                    </svg>
                </button>

                <span className="flex min-w-0 flex-1 items-center gap-1">
                    <button
                        className="cursor-pointer truncate text-left font-mono text-gray-700 text-sm dark:text-gray-300"
                        onClick={toggleCollapsed}
                        type="button"
                    >
                        {file.filename}
                    </button>
                    {file.status === "modified" && (
                        <button
                            className="ml-1 flex shrink-0 cursor-pointer items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            onClick={toggleExpandAll}
                            type="button"
                            title={expandedAll ? "Collapse all" : "Expand all"}
                        >
                            {expandedAll ? (
                                <FoldVertical size={14} />
                            ) : (
                                <UnfoldVertical size={14} />
                            )}
                        </button>
                    )}
                    <button
                        className="flex shrink-0 cursor-pointer items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() =>
                            setActiveComment(
                                activeComment?.type === "file"
                                    ? null
                                    : { type: "file" },
                            )
                        }
                        type="button"
                        title={
                            activeComment?.type === "file"
                                ? "Cancel"
                                : "Comment on file"
                        }
                    >
                        <MessageSquare size={14} />
                    </button>
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

                <label className="flex cursor-pointer items-center gap-1 text-gray-600 text-xs hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                    <input
                        checked={isViewed}
                        className="cursor-pointer rounded border-gray-300 dark:border-zinc-600"
                        onChange={toggleViewed}
                        type="checkbox"
                    />
                    Viewed
                </label>
            </div>

            {activeComment?.type === "file" && (
                <div className="border-gray-200 border-b p-2 dark:border-zinc-700">
                    <MarkdownEditor
                        autoFocus
                        disabled={
                            createMutation.isPending ||
                            startReviewMutation.isPending
                        }
                        onChange={setCommentBody}
                        onCancel={() => {
                            setActiveComment(null);
                            setCommentBody("");
                        }}
                        placeholder="Leave a comment on this file..."
                        value={commentBody}
                        owner={owner}
                        repo={repo}
                        footerActions={footerActions}
                    />
                    {(createMutation.isError ||
                        startReviewMutation.isError) && (
                        <p className="mt-1 text-red-600 text-xs">
                            Failed to post comment. Please try again.
                        </p>
                    )}
                </div>
            )}

            {fileLevelComments.length > 0 &&
                groupThreads(fileLevelComments).map((thread) => (
                    <Fragment key={`file-thread-${thread.parent.id}`}>
                        <InlineCommentThread
                            parentComment={thread.parent}
                            replies={thread.replies}
                            owner={owner}
                            repo={repo}
                            number={Number(number)}
                            pendingReviewId={pendingReviewId}
                        />
                    </Fragment>
                ))}

            <div className="overflow-hidden rounded-b">
                {!isCollapsed &&
                    (performanceHidden && !showPerformanceDiff ? (
                        <div className="flex flex-col items-center gap-2 border-gray-200 border-t px-4 py-6 text-gray-500 text-sm dark:border-gray-700 dark:text-gray-400">
                            <span>
                                {file.status === "removed"
                                    ? "This file was deleted."
                                    : file.additions + file.deletions > 1000
                                      ? `This diff is large (${(file.additions + file.deletions).toLocaleString()} lines changed) and is hidden by default.`
                                      : "This diff is hidden to improve performance."}
                            </span>
                            <button
                                className="cursor-pointer font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                onClick={() => onTogglePerformanceDiff?.()}
                                type="button"
                            >
                                Show changes
                            </button>
                        </div>
                    ) : generated && !showGeneratedDiff ? (
                        <div className="flex flex-col items-center gap-2 border-gray-200 border-t px-4 py-6 text-gray-500 text-sm dark:border-gray-700 dark:text-gray-400">
                            <span>
                                This file is generated and hidden by default.
                            </span>
                            <button
                                className="cursor-pointer font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                onClick={() => onToggleGeneratedDiff?.()}
                                type="button"
                            >
                                Show changes
                            </button>
                        </div>
                    ) : isSvg && svgContentUrls ? (
                        <SvgDiff
                            patch={file.patch as string}
                            filename={file.filename}
                            oldContentUrl={svgContentUrls.oldUrl}
                            newContentUrl={svgContentUrls.newUrl}
                            comments={lineComments}
                            showComments={effectiveShowComments}
                            showCommentButton={true}
                            activeComment={activeComment}
                            onStartComment={setActiveComment}
                            commentBody={commentBody}
                            onCommentBodyChange={setCommentBody}
                            commentPending={
                                createMutation.isPending ||
                                startReviewMutation.isPending
                            }
                            commentError={
                                createMutation.isError ||
                                startReviewMutation.isError
                            }
                            onCancelComment={() => {
                                setActiveComment(null);
                                setCommentBody("");
                            }}
                            footerActions={footerActions}
                            pendingReviewId={pendingReviewId}
                            owner={owner}
                            repo={repo}
                            pullNumber={number}
                        />
                    ) : file.patch ? (
                        <DiffView
                            patch={file.patch}
                            filename={file.filename}
                            comments={lineComments}
                            showComments={effectiveShowComments}
                            showCommentButton={true}
                            activeComment={activeComment}
                            onStartComment={setActiveComment}
                            commentBody={commentBody}
                            onCommentBodyChange={setCommentBody}
                            commentPending={
                                createMutation.isPending ||
                                startReviewMutation.isPending
                            }
                            commentError={
                                createMutation.isError ||
                                startReviewMutation.isError
                            }
                            onCancelComment={() => {
                                setActiveComment(null);
                                setCommentBody("");
                            }}
                            footerActions={footerActions}
                            pendingReviewId={pendingReviewId}
                            owner={owner}
                            repo={repo}
                            pullNumber={number}
                            headSha={headSha}
                            expandAllContext={expandedAll}
                        />
                    ) : isImage && imageUrls ? (
                        <ImageDiff
                            newUrl={imageUrls.newUrl}
                            oldUrl={imageUrls.oldUrl}
                        />
                    ) : (
                        <div className="px-4 py-3 text-gray-500 text-sm italic dark:text-gray-400">
                            {file.status === "renamed"
                                ? `File renamed from ${file.previous_filename} without changes`
                                : file.additions === 0 && file.deletions === 0
                                  ? "Whitespace-only changes."
                                  : "Binary file not shown"}
                        </div>
                    ))}
            </div>
        </div>
    );
}
