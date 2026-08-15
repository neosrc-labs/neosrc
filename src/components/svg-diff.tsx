"use client";

import { Code, Eye } from "lucide-react";
import { useState } from "react";
import { DiffModeToggle } from "./diff-mode-toggle";
import { type DiffCommentProps, DiffView } from "./diff-view";
import { SvgPreview } from "./media-diff/svg-preview";
import { useSvgContents } from "./media-diff/use-svg-contents";

type ViewMode = "rendered" | "code";

interface SvgDiffProps extends DiffCommentProps {
    patch: string;
    filename: string;
    oldContentUrl: string | null;
    newContentUrl: string | null;
}

export default function SvgDiff({
    patch,
    filename,
    oldContentUrl,
    newContentUrl,
    comments,
    showComments,
    showCommentButton,
    activeComment,
    onStartComment,
    commentBody,
    onCommentBodyChange,
    footerActions,
    commentPending,
    commentError,
    onCancelComment,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
}: SvgDiffProps) {
    const [mode, setMode] = useState<ViewMode>("rendered");
    const { oldContent, newContent, loading, oldError, newError } =
        useSvgContents(oldContentUrl, newContentUrl);
    const hasBoth = oldContentUrl !== null && newContentUrl !== null;

    const modes: Array<{
        icon: typeof Eye;
        label: string;
        value: ViewMode;
    }> = [
        { icon: Eye, label: "Rendered", value: "rendered" },
        { icon: Code, label: "Code", value: "code" },
    ];

    function renderIframe(content: string, title: string) {
        return <SvgPreview content={content} title={title} />;
    }

    return (
        <div>
            {mode === "code" ? (
                <DiffView
                    patch={patch}
                    filename={filename}
                    comments={comments}
                    showComments={showComments}
                    showCommentButton={showCommentButton}
                    activeComment={activeComment}
                    onStartComment={onStartComment}
                    commentBody={commentBody}
                    onCommentBodyChange={onCommentBodyChange}
                    footerActions={footerActions}
                    commentPending={commentPending}
                    commentError={commentError}
                    onCancelComment={onCancelComment}
                    owner={owner}
                    repo={repo}
                    pullNumber={pullNumber}
                    pendingReviewId={pendingReviewId}
                    permissionContext={permissionContext}
                />
            ) : (
                <div>
                    {loading && (
                        <div className="flex items-center justify-center bg-[#f0f0f0] px-4 py-12 dark:bg-zinc-900">
                            <span className="text-sm text-text-tertiary">
                                Loading SVG...
                            </span>
                        </div>
                    )}
                    {!loading && !hasBoth && newContent != null && (
                        <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                            {newError ? (
                                <span className="text-sm text-text-tertiary">
                                    Failed to load SVG
                                </span>
                            ) : (
                                renderIframe(newContent, "SVG preview")
                            )}
                        </div>
                    )}
                    {!loading && !hasBoth && oldContent != null && (
                        <div className="flex items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                            {oldError ? (
                                <span className="text-sm text-text-tertiary">
                                    Failed to load SVG
                                </span>
                            ) : (
                                renderIframe(oldContent, "SVG preview")
                            )}
                        </div>
                    )}
                    {!loading && hasBoth && (
                        <div className="flex flex-col md:flex-row">
                            <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                                <div className="border-border border-b bg-surface-secondary px-3 py-1.5 text-center font-medium text-red-600 text-xs uppercase tracking-wide dark:text-red-400">
                                    Deleted
                                </div>
                                <div className="flex flex-1 items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                                    {oldError ? (
                                        <span className="text-sm text-text-tertiary">
                                            Failed to load SVG
                                        </span>
                                    ) : (
                                        renderIframe(
                                            oldContent ?? "",
                                            "Deleted SVG",
                                        )
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-1 flex-col">
                                <div className="border-border border-b bg-surface-secondary px-3 py-1.5 text-center font-medium text-green-600 text-xs uppercase tracking-wide dark:text-green-400">
                                    Added
                                </div>
                                <div className="flex flex-1 items-center justify-center bg-[#f0f0f0] p-4 dark:bg-zinc-900">
                                    {newError ? (
                                        <span className="text-sm text-text-tertiary">
                                            Failed to load SVG
                                        </span>
                                    ) : (
                                        renderIframe(
                                            newContent ?? "",
                                            "Added SVG",
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <DiffModeToggle mode={mode} modes={modes} onModeChange={setMode} />
        </div>
    );
}
