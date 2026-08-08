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
import { type ActiveComment, DiffView, groupThreads } from "./diff-view";
import ImageDiff from "./image-diff";
import { InlineCommentThread } from "./inline-comment-thread";
import type { FooterAction } from "./markdown/markdown-editor";
import { MarkdownEditor } from "./markdown/markdown-editor";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "./review-comment-utils";
import SvgDiff from "./svg-diff";

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
    const {
        isViewed,
        isCollapsed,
        activeComment,
        commentBody,
        expandedAll,
        headerRef,
        setActiveComment,
        setCommentBody,
        toggleCollapsed,
        toggleExpandAll,
        toggleViewed,
        onToggleFileComment,
        isFileCommentOpen,
    } = useFileDiffState({ owner, repo, number, filename: file.filename });

    const recentlyAddedIds = useRef(new Set<number>());

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

    const {
        createMutation,
        startReviewMutation,
        footerActions,
        effectiveShowComments,
    } = useFileCommentActions({
        owner,
        repo,
        number,
        filename: file.filename,
        pendingReviewId,
        showComments,
        commentBody,
        activeComment,
        recentlyAddedIds,
        setActiveComment,
        setCommentBody,
    });

    return (
        <div className="rounded border border-border">
            <FileDiffHeader
                file={file}
                isCollapsed={isCollapsed}
                isViewed={isViewed}
                expandedAll={expandedAll}
                headerRef={headerRef}
                onToggleCollapsed={toggleCollapsed}
                onToggleExpandAll={toggleExpandAll}
                onToggleViewed={toggleViewed}
                onToggleFileComment={onToggleFileComment}
                isFileCommentOpen={isFileCommentOpen}
            />

            <FileCommentEditor
                open={activeComment?.type === "file"}
                value={commentBody}
                onChange={setCommentBody}
                onCancel={() => {
                    setActiveComment(null);
                    setCommentBody("");
                }}
                footerActions={footerActions}
                disabled={
                    createMutation.isPending || startReviewMutation.isPending
                }
                error={createMutation.isError || startReviewMutation.isError}
                owner={owner}
                repo={repo}
            />

            <FileCommentThreads
                comments={fileLevelComments}
                owner={owner}
                repo={repo}
                pullNumber={number}
                pendingReviewId={pendingReviewId}
            />

            <div className="overflow-hidden rounded-b">
                {!isCollapsed && (
                    <DiffContent
                        file={file}
                        performanceHidden={performanceHidden}
                        showPerformanceDiff={showPerformanceDiff}
                        onTogglePerformanceDiff={onTogglePerformanceDiff}
                        generated={generated}
                        showGeneratedDiff={showGeneratedDiff}
                        onToggleGeneratedDiff={onToggleGeneratedDiff}
                        isSvg={isSvg}
                        svgContentUrls={svgContentUrls}
                        isImage={!!isImage}
                        imageUrls={imageUrls}
                        lineComments={lineComments}
                        showComments={effectiveShowComments}
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
                )}
            </div>
        </div>
    );
}

interface UseFileDiffStateParams {
    owner: string;
    repo: string;
    number: string;
    filename: string;
}

function useFileDiffState({
    owner,
    repo,
    number,
    filename,
}: UseFileDiffStateParams) {
    const [isViewed, setIsViewed] = useState(() => {
        if (typeof window === "undefined") return false;
        return getStoredSet(getViewedKey(owner, repo, number)).has(filename);
    });
    const [isCollapsed, setIsCollapsed] = useState(isViewed);
    const [activeComment, setActiveComment] = useState<ActiveComment | null>(
        null,
    );
    const [commentBody, setCommentBody] = useState("");
    const [expandedAll, setExpandedAll] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);

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
            viewed.delete(filename);
        } else {
            viewed.add(filename);
        }
        setStoredSet(key, viewed);
        setIsViewed(!isViewed);
        if (isViewed === isCollapsed) {
            toggleCollapsed();
        }
        window.dispatchEvent(new Event("file-viewed-changed"));
    };

    const onToggleFileComment = () =>
        setActiveComment(
            activeComment?.type === "file" ? null : { type: "file" },
        );

    return {
        isViewed,
        isCollapsed,
        activeComment,
        commentBody,
        expandedAll,
        headerRef,
        setActiveComment,
        setCommentBody,
        toggleCollapsed,
        toggleExpandAll,
        toggleViewed,
        onToggleFileComment,
        isFileCommentOpen: activeComment?.type === "file",
    };
}

interface UseFileCommentActionsParams {
    owner: string;
    repo: string;
    number: string;
    filename: string;
    pendingReviewId?: number | null;
    showComments: boolean;
    commentBody: string;
    activeComment: ActiveComment | null;
    recentlyAddedIds: React.RefObject<Set<number>>;
    setActiveComment: (comment: ActiveComment | null) => void;
    setCommentBody: (body: string) => void;
}

function useFileCommentActions({
    owner,
    repo,
    number,
    filename,
    pendingReviewId,
    showComments,
    commentBody,
    activeComment,
    recentlyAddedIds,
    setActiveComment,
    setCommentBody,
}: UseFileCommentActionsParams) {
    const utils = api.useUtils();
    const { data: currentUserData } = api.users.currentUser.useQuery();

    const createMutation = api.reviewComments.create.useMutation({
        onMutate: async (input) => {
            if (input.asReview) {
                await utils.reviews.getPending.cancel({
                    owner,
                    repo,
                    number: Number(number),
                });
                const prevData = utils.reviews.getPending.getData({
                    owner,
                    repo,
                    number: Number(number),
                });
                return { prevData, isReview: true as const };
            }

            await utils.reviewComments.list.cancel({
                owner,
                repo,
                number: Number(number),
            });
            const prevData = utils.reviewComments.list.getData({
                owner,
                repo,
                number: Number(number),
            });
            return { prevData, isReview: false as const };
        },
        onError: (_err, _vars, ctx) => {
            if (!ctx?.prevData) return;
            if (ctx.isReview) {
                utils.reviews.getPending.setData(
                    { owner, repo, number: Number(number) },
                    ctx.prevData,
                );
            } else {
                utils.reviewComments.list.setData(
                    { owner, repo, number: Number(number) },
                    ctx.prevData,
                );
            }
        },
        onSuccess: (data) => {
            if (!showComments && data?.id) {
                recentlyAddedIds.current.add(data.id);
            }
        },
        onSettled: (_data, _err, input) => {
            if (input.asReview) {
                utils.reviews.getPending.invalidate({
                    owner,
                    repo,
                    number: Number(number),
                });
            } else {
                utils.reviewComments.list.invalidate({
                    owner,
                    repo,
                    number: Number(number),
                });
            }
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
            const body = commentBody;
            const savedActiveComment = activeComment;

            const args: Parameters<typeof createMutation.mutate>[0] = {
                owner,
                repo,
                number: Number(number),
                filePath: filename,
                body,
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

            setCommentBody("");
            setActiveComment(null);

            let prevPending:
                | Awaited<ReturnType<typeof utils.reviews.getPending.getData>>
                | undefined;

            const userLogin = currentUserData?.login;
            if (userLogin) {
                const listData = utils.reviewComments.list.getData({
                    owner,
                    repo,
                    number: Number(number),
                });
                const pendingData = utils.reviews.getPending.getData({
                    owner,
                    repo,
                    number: Number(number),
                });
                const authorAssociation =
                    findAuthorAssociation(listData ?? [], userLogin) ??
                    findAuthorAssociation(
                        pendingData?.comments ?? [],
                        userLogin,
                    );

                const stub = createReviewCommentStub({
                    body,
                    filePath: filename,
                    currentUser: {
                        login: userLogin,
                        avatarUrl: currentUserData.avatarUrl,
                    },
                    lineNumber: args.lineNumber,
                    side: args.side,
                    startLineNumber: args.startLineNumber,
                    startSide: args.startSide,
                    pendingReviewId: isReview ? (pendingReviewId ?? 0) : null,
                    authorAssociation,
                });

                const stubId = stub.id;

                if (isReview) {
                    prevPending = utils.reviews.getPending.getData({
                        owner,
                        repo,
                        number: Number(number),
                    });
                    utils.reviews.getPending.setData(
                        { owner, repo, number: Number(number) },
                        (old) => {
                            const comments = [
                                ...(old?.comments ?? []),
                                stub,
                            ] as typeof old extends { comments: infer C }
                                ? C
                                : never;
                            return {
                                reviewId: old?.reviewId ?? 0,
                                comments,
                            };
                        },
                    );
                } else {
                    utils.reviewComments.list.setData(
                        { owner, repo, number: Number(number) },
                        (old) => {
                            if (!old) return old;
                            return [...old, stub];
                        },
                    );
                }

                if (!showComments) {
                    recentlyAddedIds.current.add(stubId);
                }
            }

            const doCreateComment = () => {
                createMutation.mutate(args);
            };

            const rollbackComment = () => {
                setCommentBody(body);
                setActiveComment(savedActiveComment);
                if (prevPending != null) {
                    utils.reviews.getPending.setData(
                        { owner, repo, number: Number(number) },
                        prevPending,
                    );
                }
            };

            if (isReview && !pendingReviewId) {
                startReviewMutation.mutate(
                    { owner, repo, number: Number(number) },
                    {
                        onSuccess: doCreateComment,
                        onError: rollbackComment,
                    },
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
            filename,
            currentUserData,
            showComments,
            utils,
            recentlyAddedIds,
            setActiveComment,
            setCommentBody,
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

    const effectiveShowComments =
        showComments || recentlyAddedIds.current.size > 0;

    return {
        createMutation,
        startReviewMutation,
        footerActions,
        effectiveShowComments,
    };
}

interface FileDiffHeaderProps {
    file: FileDiffProps["file"];
    isCollapsed: boolean;
    isViewed: boolean;
    expandedAll: boolean;
    headerRef: React.RefObject<HTMLDivElement | null>;
    onToggleCollapsed: () => void;
    onToggleExpandAll: () => void;
    onToggleViewed: () => void;
    onToggleFileComment: () => void;
    isFileCommentOpen: boolean;
}

function FileDiffHeader({
    file,
    isCollapsed,
    isViewed,
    expandedAll,
    headerRef,
    onToggleCollapsed,
    onToggleExpandAll,
    onToggleViewed,
    onToggleFileComment,
    isFileCommentOpen,
}: FileDiffHeaderProps) {
    const statusColor =
        file.status === "added"
            ? "text-green-600"
            : file.status === "deleted"
              ? "text-red-600"
              : file.status === "renamed"
                ? "text-blue-600"
                : "text-yellow-600";

    return (
        <div
            ref={headerRef}
            className="sticky top-[64px] z-[1] flex items-center gap-2 border-border border-b bg-surface-secondary px-4 py-2"
        >
            <button
                className="cursor-pointer text-text-tertiary hover:text-text-label dark:hover:text-zinc-200"
                onClick={onToggleCollapsed}
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
                className="h-4 w-4 cursor-pointer text-text-tertiary"
                onClick={onToggleCollapsed}
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
                    className="cursor-pointer truncate text-left font-mono text-sm text-text-label"
                    onClick={onToggleCollapsed}
                    type="button"
                >
                    {file.filename}
                </button>
                {file.status === "modified" && (
                    <button
                        className="ml-1 flex shrink-0 cursor-pointer items-center text-text-tertiary hover:text-text-label dark:hover:text-zinc-200"
                        onClick={onToggleExpandAll}
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

            <label className="flex cursor-pointer items-center gap-1 text-text-secondary text-xs hover:text-gray-800 dark:hover:text-zinc-200">
                <input
                    checked={isViewed}
                    className="cursor-pointer rounded border-gray-300 dark:border-zinc-600"
                    onChange={onToggleViewed}
                    type="checkbox"
                />
                Viewed
            </label>

            <button
                className="flex shrink-0 cursor-pointer items-center text-text-tertiary hover:text-text-label dark:hover:text-zinc-200"
                onClick={onToggleFileComment}
                type="button"
                title={isFileCommentOpen ? "Cancel" : "Comment on file"}
            >
                <MessageSquare size={14} />
            </button>
        </div>
    );
}

interface FileCommentEditorProps {
    open: boolean;
    value: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    footerActions: FooterAction[];
    disabled: boolean;
    error: boolean;
    owner: string;
    repo: string;
}

function FileCommentEditor({
    open,
    value,
    onChange,
    onCancel,
    footerActions,
    disabled,
    error,
    owner,
    repo,
}: FileCommentEditorProps) {
    if (!open) return null;
    return (
        <div className="border-border border-b p-2">
            <MarkdownEditor
                autoFocus
                disabled={disabled}
                onChange={onChange}
                onCancel={onCancel}
                placeholder="Leave a comment on this file..."
                value={value}
                owner={owner}
                repo={repo}
                footerActions={footerActions}
            />
            {error && (
                <p className="mt-1 text-red-600 text-xs">
                    Failed to post comment. Please try again.
                </p>
            )}
        </div>
    );
}

interface HiddenDiffNoticeProps {
    message: string;
    onShow: () => void;
}

function HiddenDiffNotice({ message, onShow }: HiddenDiffNoticeProps) {
    return (
        <div className="flex flex-col items-center gap-2 border-border border-t px-4 py-6 text-sm text-text-tertiary">
            <span>{message}</span>
            <button
                className="cursor-pointer font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={onShow}
                type="button"
            >
                Show changes
            </button>
        </div>
    );
}

interface FileCommentThreadsProps {
    comments: ReviewComment[];
    owner: string;
    repo: string;
    pullNumber: string;
    pendingReviewId?: number | null;
}

function FileCommentThreads({
    comments,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
}: FileCommentThreadsProps) {
    return (
        <>
            {comments.length > 0 &&
                groupThreads(comments).map((thread) => (
                    <Fragment key={`file-thread-${thread.parent.id}`}>
                        <InlineCommentThread
                            parentComment={thread.parent}
                            replies={thread.replies}
                            owner={owner}
                            repo={repo}
                            number={Number(pullNumber)}
                            pendingReviewId={pendingReviewId}
                        />
                    </Fragment>
                ))}
        </>
    );
}

interface DiffContentProps {
    file: FileDiffProps["file"];
    performanceHidden: boolean;
    showPerformanceDiff: boolean;
    onTogglePerformanceDiff?: () => void;
    generated: boolean;
    showGeneratedDiff: boolean;
    onToggleGeneratedDiff?: () => void;
    isSvg: boolean;
    svgContentUrls: { oldUrl: string | null; newUrl: string | null } | null;
    isImage: boolean;
    imageUrls: { oldUrl: string | null; newUrl: string | null } | null;
    lineComments: ReviewComment[];
    showComments: boolean;
    activeComment: ActiveComment | null;
    onStartComment: (ac: ActiveComment | null) => void;
    commentBody: string;
    onCommentBodyChange: (body: string) => void;
    commentPending: boolean;
    commentError: boolean;
    onCancelComment: () => void;
    footerActions: FooterAction[];
    pendingReviewId?: number | null;
    owner: string;
    repo: string;
    pullNumber: string;
    headSha?: string;
    expandAllContext: boolean;
}

function DiffContent({
    file,
    performanceHidden,
    showPerformanceDiff,
    onTogglePerformanceDiff,
    generated,
    showGeneratedDiff,
    onToggleGeneratedDiff,
    isSvg,
    svgContentUrls,
    isImage,
    imageUrls,
    lineComments,
    showComments,
    activeComment,
    onStartComment,
    commentBody,
    onCommentBodyChange,
    commentPending,
    commentError,
    onCancelComment,
    footerActions,
    pendingReviewId,
    owner,
    repo,
    pullNumber,
    headSha,
    expandAllContext,
}: DiffContentProps) {
    return performanceHidden && !showPerformanceDiff ? (
        <HiddenDiffNotice
            message={
                file.status === "removed"
                    ? "This file was deleted."
                    : file.additions + file.deletions > 1000
                      ? `This diff is large (${(file.additions + file.deletions).toLocaleString()} lines changed) and is hidden by default.`
                      : "This diff is hidden to improve performance."
            }
            onShow={() => onTogglePerformanceDiff?.()}
        />
    ) : generated && !showGeneratedDiff ? (
        <HiddenDiffNotice
            message="This file is generated and hidden by default."
            onShow={() => onToggleGeneratedDiff?.()}
        />
    ) : isSvg && svgContentUrls ? (
        <SvgDiff
            patch={file.patch as string}
            filename={file.filename}
            oldContentUrl={svgContentUrls.oldUrl}
            newContentUrl={svgContentUrls.newUrl}
            comments={lineComments}
            showComments={showComments}
            showCommentButton={true}
            activeComment={activeComment}
            onStartComment={onStartComment}
            commentBody={commentBody}
            onCommentBodyChange={onCommentBodyChange}
            commentPending={commentPending}
            commentError={commentError}
            onCancelComment={onCancelComment}
            footerActions={footerActions}
            pendingReviewId={pendingReviewId}
            owner={owner}
            repo={repo}
            pullNumber={pullNumber}
        />
    ) : file.patch ? (
        <DiffView
            patch={file.patch}
            filename={file.filename}
            comments={lineComments}
            showComments={showComments}
            showCommentButton={true}
            activeComment={activeComment}
            onStartComment={onStartComment}
            commentBody={commentBody}
            onCommentBodyChange={onCommentBodyChange}
            commentPending={commentPending}
            commentError={commentError}
            onCancelComment={onCancelComment}
            footerActions={footerActions}
            pendingReviewId={pendingReviewId}
            owner={owner}
            repo={repo}
            pullNumber={pullNumber}
            headSha={headSha}
            expandAllContext={expandAllContext}
        />
    ) : isImage && imageUrls ? (
        <ImageDiff newUrl={imageUrls.newUrl} oldUrl={imageUrls.oldUrl} />
    ) : (
        <div className="px-4 py-3 text-sm text-text-tertiary italic">
            {file.status === "renamed"
                ? `File renamed from ${file.previous_filename} without changes`
                : file.additions === 0 && file.deletions === 0
                  ? "Whitespace-only changes."
                  : "Binary file not shown"}
        </div>
    );
}
