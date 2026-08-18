"use client";

import { useMemo, useRef } from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import { useInView } from "~/hooks/use-in-view";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { type DiffCommentTarget, DiffView } from "./diff-view";
import { FileCommentEditor as FileCommentEditorView } from "./file-comment-editor";
import { FileCommentThreads as FileCommentThreadsView } from "./file-comment-threads";
import { FileDiffHeader as FileDiffHeaderView } from "./file-diff-header";
import {
    buildRawContentUrls,
    resolveFileDiffPresentation,
} from "./file-diff-source";
import { HiddenDiffNotice as HiddenDiffNoticeView } from "./hidden-diff-notice";
import ImageDiff from "./image-diff";
import type { FooterAction } from "./markdown/markdown-editor";
import { isFileComment, isLineComment } from "./review-comment-threads";
import SvgDiff from "./svg-diff";
import { useFileCommentActions } from "./use-file-comment-actions";
import { useFileDiffState } from "./use-file-diff-state";

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
    permissionContext: PullRequestPermissionContext;
    performanceHidden?: boolean;
    showPerformanceDiff?: boolean;
    onTogglePerformanceDiff?: () => void;
    diffView?: DiffViewMode;
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
    permissionContext,
    performanceHidden = false,
    showPerformanceDiff = true,
    onTogglePerformanceDiff,
    diffView = "unified",
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
        toggleFileComment,
        isFileCommentOpen,
        clearComment,
    } = useFileDiffState({ owner, repo, number, filename: file.filename });

    const recentlyAddedIds = useRef(new Set<number>());

    const presentation = resolveFileDiffPresentation({
        filename: file.filename,
        patch: file.patch,
        status: file.status,
        performanceHidden,
        showPerformanceDiff,
        baseSha,
        additions: file.additions,
        deletions: file.deletions,
    });
    const isImage = presentation === "image";
    const isSvg = presentation === "svg";

    const [inViewRef, inView, inViewReady] = useInView({
        rootMargin: "400px",
    });
    const estimatedHeight = useMemo(() => {
        if (!file.patch) return 0;
        return file.patch.split("\n").length * 20;
    }, [file.patch]);

    const svgContentUrls = useMemo(() => {
        if (!isSvg) return null;
        return buildRawContentUrls({
            filename: file.filename,
            previousFilename: file.previous_filename,
            status: file.status,
            owner,
            repo,
            baseSha,
            headSha,
        });
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
        return buildRawContentUrls({
            filename: file.filename,
            previousFilename: file.previous_filename,
            status: file.status,
            owner,
            repo,
            baseSha,
            headSha,
        });
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
            (c) => c.path === file.filename && isFileComment(c),
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
        onCommentSuccess: clearComment,
    });

    return (
        <div className="rounded border border-border">
            <FileDiffHeaderView
                file={file}
                isCollapsed={isCollapsed}
                isViewed={isViewed}
                expandedAll={expandedAll}
                headerRef={headerRef}
                onToggleCollapsed={toggleCollapsed}
                onToggleExpandAll={toggleExpandAll}
                onToggleViewed={toggleViewed}
                onToggleFileComment={toggleFileComment}
                isFileCommentOpen={isFileCommentOpen}
            />
            <FileCommentEditorView
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
            <FileCommentThreadsView
                comments={fileLevelComments}
                owner={owner}
                repo={repo}
                pullNumber={number}
                pendingReviewId={pendingReviewId}
                permissionContext={permissionContext}
            />
            <div ref={inViewRef} className="overflow-hidden rounded-b">
                {!isCollapsed && (
                    <DiffContent
                        file={file}
                        inView={inView}
                        inViewReady={inViewReady}
                        estimatedHeight={estimatedHeight}
                        performanceHidden={performanceHidden}
                        showPerformanceDiff={showPerformanceDiff}
                        onTogglePerformanceDiff={onTogglePerformanceDiff}
                        isSvg={isSvg}
                        svgContentUrls={svgContentUrls}
                        isImage={isImage}
                        imageUrls={imageUrls}
                        diffView={diffView}
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
                        permissionContext={permissionContext}
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

interface DiffContentProps {
    file: FileDiffProps["file"];
    performanceHidden: boolean;
    showPerformanceDiff: boolean;
    inView: boolean;
    inViewReady: boolean;
    estimatedHeight: number;
    onTogglePerformanceDiff?: () => void;
    isSvg: boolean;
    svgContentUrls: { oldUrl: string | null; newUrl: string | null } | null;
    isImage: boolean;
    imageUrls: { oldUrl: string | null; newUrl: string | null } | null;
    diffView: DiffViewMode;
    lineComments: ReviewComment[];
    showComments: boolean;
    activeComment: DiffCommentTarget | null;
    onStartComment: (ac: DiffCommentTarget | null) => void;
    commentBody: string;
    onCommentBodyChange: (body: string) => void;
    commentPending: boolean;
    commentError: boolean;
    onCancelComment: () => void;
    footerActions: FooterAction[];
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
    owner: string;
    repo: string;
    pullNumber: string;
    headSha?: string;
    expandAllContext: boolean;
}
function DiffContent({
    file,
    inView,
    inViewReady,
    estimatedHeight,
    performanceHidden,
    showPerformanceDiff,
    onTogglePerformanceDiff,
    isSvg,
    svgContentUrls,
    isImage,
    imageUrls,
    diffView,
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
    permissionContext,
    owner,
    repo,
    pullNumber,
    headSha,
    expandAllContext,
}: DiffContentProps) {
    const diffCommentProps = {
        comments: lineComments,
        showComments,
        showCommentButton: true,
        activeComment,
        onStartComment,
        commentBody,
        onCommentBodyChange,
        commentPending,
        commentError,
        onCancelComment,
        footerActions,
        pendingReviewId,
        permissionContext,
        owner,
        repo,
        pullNumber,
    };

    return performanceHidden && !showPerformanceDiff ? (
        <HiddenDiffNoticeView
            message={
                file.status === "removed"
                    ? "This file was deleted."
                    : file.additions + file.deletions > 1000
                      ? `This diff is large (${(file.additions + file.deletions).toLocaleString()} lines changed) and is hidden by default.`
                      : "This diff is hidden to improve performance."
            }
            onShow={() => onTogglePerformanceDiff?.()}
        />
    ) : isSvg && svgContentUrls ? (
        <SvgDiff
            patch={file.patch as string}
            filename={file.filename}
            oldContentUrl={svgContentUrls.oldUrl}
            newContentUrl={svgContentUrls.newUrl}
            {...diffCommentProps}
        />
    ) : file.patch ? (
        <DiffView
            patch={file.patch}
            filename={file.filename}
            {...diffCommentProps}
            headSha={headSha}
            expandAllContext={expandAllContext}
            view={diffView}
            inView={inView}
            inViewReady={inViewReady}
            estimatedHeight={estimatedHeight}
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
