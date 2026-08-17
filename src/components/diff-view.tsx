"use client";

import type { SelectedLineRange } from "@pierre/diffs";
import { type DiffLineAnnotation, PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useState } from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import type { DiffCommentTarget, DiffSide } from "./diff/types";
import { InlineCommentThread } from "./inline-comment-thread";
import type { FooterAction } from "./markdown/markdown-editor";
import { groupReviewCommentThreads } from "./review-comment-threads";

export type { DiffCommentTarget } from "./diff/types";

interface DiffViewProps extends DiffCommentProps {
    patch: string;
    filename: string;
    headSha?: string;
    expandAllContext?: boolean;
    view?: DiffViewMode;
}

/** Comment-related props shared by the diff views (DiffView, SvgDiff). */
export interface DiffCommentProps {
    comments?: ReviewComment[];
    showComments?: boolean;
    showCommentButton?: boolean;
    activeComment?: DiffCommentTarget | null;
    onStartComment?: (ac: DiffCommentTarget | null) => void;
    commentBody?: string;
    onCommentBodyChange?: (body: string) => void;
    footerActions?: FooterAction[];
    commentPending?: boolean;
    commentError?: boolean;
    onCancelComment?: () => void;
    owner?: string;
    repo?: string;
    pullNumber?: number | string;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}

/**
 * Metadata attached to each annotation so the render slot knows which
 * comment thread to display and how to anchor it.
 */
interface CommentAnnotationMeta {
    comments: ReviewComment[];
    side: DiffSide;
    line: number;
}

export function DiffView({
    patch,
    filename,
    comments = [],
    showComments = false,
    showCommentButton = false,
    activeComment = null,
    onStartComment,
    expandAllContext = false,
    view = "unified",
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
}: DiffViewProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    // GitHub's per-file patch field starts with @@ -x,y +x,y @@ but
    // @pierre/diffs expects the full "diff --git" format. Wrap bare hunks.
    const normalizedPatch = useMemo(() => {
        if (patch.startsWith("diff --git") || patch.includes("\ndiff --git")) {
            return patch;
        }
        return [
            `diff --git a/${filename} b/${filename}`,
            `--- a/${filename}`,
            `+++ b/${filename}`,
            patch,
        ].join("\n");
    }, [patch, filename]);

    // Line selection state for comment anchoring and permalink
    const [selectedLines, setSelectedLines] =
        useState<SelectedLineRange | null>(null);

    // Build comment annotations from review comments
    const annotations = useMemo(() => {
        if (!showComments || comments.length === 0) return undefined;

        const annots: DiffLineAnnotation<CommentAnnotationMeta>[] = [];
        const threadsByPosition = new Map<string, ReviewComment[]>();

        for (const comment of comments) {
            if (!comment.diff_hunk) continue;
            const anchor = parseCommentAnchor(comment);
            if (!anchor) continue;

            const key = `${anchor.line}-${anchor.side}`;
            const existing = threadsByPosition.get(key) ?? [];
            existing.push(comment);
            threadsByPosition.set(key, existing);
        }

        for (const [key, threadComments] of threadsByPosition) {
            const parts = key.split("-");
            const lineStr = parts[0] ?? "0";
            const sideStr = parts[1] ?? "RIGHT";
            const line = Number.parseInt(lineStr, 10);
            const side = sideStr as DiffSide;
            annots.push({
                side: side === "RIGHT" ? "additions" : "deletions",
                lineNumber: line,
                metadata: {
                    comments: threadComments,
                    side,
                    line,
                },
            });
        }

        return annots.length > 0 ? annots : undefined;
    }, [comments, showComments]);

    const handleSelectedLinesChange = useCallback(
        (range: SelectedLineRange | null) => {
            setSelectedLines(range);
            // Update URL hash for permalink
            if (range) {
                const hash = `#diff-${filename.replace(/[^a-zA-Z0-9]/g, "-")}R${range.start}${range.end !== range.start ? `-R${range.end}` : ""}`;
                history.replaceState(null, "", hash);
            }
        },
        [filename],
    );

    return (
        <div className="overflow-x-auto">
            <PatchDiff
                patch={normalizedPatch}
                options={{
                    theme: isDark
                        ? { light: "github-light", dark: "github-dark" }
                        : { light: "github-light", dark: "github-dark" },
                    diffStyle: view,
                    expandUnchanged: expandAllContext,
                    stickyHeader: true,
                    enableLineSelection: showCommentButton,
                    lineDiffType: "word",
                    onLineSelectionEnd: handleSelectedLinesChange,
                }}
                lineAnnotations={annotations}
                selectedLines={selectedLines}
                renderAnnotation={(annotation) => {
                    const meta = annotation.metadata;
                    if (!meta) return null;
                    return (
                        <CommentThread
                            comments={meta.comments}
                            side={meta.side}
                            line={meta.line}
                            owner={owner}
                            repo={repo}
                            pullNumber={pullNumber}
                            pendingReviewId={pendingReviewId}
                            permissionContext={permissionContext}
                            activeComment={activeComment}
                            onStartComment={onStartComment}
                            showComments={showComments}
                            showCommentButton={showCommentButton}
                        />
                    );
                }}
            />
        </div>
    );
}

/**
 * Parse a GitHub review comment's diff_hunk to extract the anchor line and
 * side in the new file. The diff_hunk starts with @@ -oldStart,oldCount
 * +newStart,newCount @@ and the comment's position is relative to it.
 */
function parseCommentAnchor(
    comment: ReviewComment,
): { line: number; side: DiffSide } | null {
    const hunk = comment.diff_hunk;
    if (!hunk) return null;

    const lines = hunk.split("\n");
    const headerLine = lines[0];
    if (!headerLine?.startsWith("@@")) return null;

    const match = headerLine.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
    );
    if (!match) return null;

    const newStart = Number.parseInt(match[3] ?? "0", 10);
    let newLine = newStart;
    let oldLine = Number.parseInt(match[1] ?? "0", 10);

    // Walk through hunk lines to find the comment's position
    const targetLine = comment.original_line ?? comment.line;
    const targetSide: DiffSide = comment.side === "LEFT" ? "LEFT" : "RIGHT";

    if (targetLine == null) return null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        if (line.startsWith("+")) {
            if (targetSide === "RIGHT" && newLine === targetLine) {
                return { line: newLine, side: "RIGHT" };
            }
            newLine++;
        } else if (line.startsWith("-")) {
            if (targetSide === "LEFT" && oldLine === targetLine) {
                return { line: newLine, side: "LEFT" };
            }
            oldLine++;
        } else {
            // Context line - exists on both sides
            if (newLine === targetLine) {
                return { line: newLine, side: targetSide };
            }
            newLine++;
            oldLine++;
        }
    }

    return null;
}

/** Render a comment thread for a diff line annotation. */
function CommentThread({
    comments,
    side,
    line,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
    activeComment,
    onStartComment,
    showComments,
    showCommentButton,
}: {
    comments: ReviewComment[];
    side: DiffSide;
    line: number;
    owner?: string;
    repo?: string;
    pullNumber?: number | string;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
    activeComment?: DiffCommentTarget | null;
    onStartComment?: (ac: DiffCommentTarget | null) => void;
    showComments: boolean;
    showCommentButton: boolean;
}) {
    const threads = useMemo(
        () => groupReviewCommentThreads(comments),
        [comments],
    );

    const isActive =
        activeComment?.type === "line" &&
        activeComment.line === line &&
        activeComment.side === side;

    return (
        <div className="border-border border-t bg-surface-secondary px-4 py-2">
            {showComments &&
                threads.map((thread) => (
                    <InlineCommentThread
                        key={thread.parent.id}
                        parentComment={thread.parent}
                        replies={thread.replies}
                        owner={owner ?? ""}
                        repo={repo ?? ""}
                        number={Number(pullNumber ?? 0)}
                        pendingReviewId={pendingReviewId}
                        permissionContext={permissionContext}
                    />
                ))}
            {showCommentButton && (
                <button
                    className="mt-1 cursor-pointer text-blue-600 text-xs hover:underline"
                    onClick={() =>
                        onStartComment?.(
                            isActive ? null : { type: "line", line, side },
                        )
                    }
                    type="button"
                >
                    {isActive ? "Cancel" : "Add comment"}
                </button>
            )}
        </div>
    );
}
