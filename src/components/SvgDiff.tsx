"use client";

import { Code, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReviewComment } from "~/server/github";
import type { ActiveComment } from "./DiffView";
import { DiffView } from "./DiffView";
import type { FooterAction } from "./markdown/MarkdownEditor";

type ViewMode = "rendered" | "code";

function buildSvgSrcDoc(svgContent: string): string {
    return `<!DOCTYPE html>
<html style="margin:0;padding:0;width:100%;height:100%;">
<body style="margin:0;padding:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
<style>
  svg { max-width: 100%; max-height: 100%; height: auto; }
</style>
${svgContent}
</body>
</html>`;
}

interface SvgDiffProps {
    patch: string;
    filename: string;
    oldContentUrl: string | null;
    newContentUrl: string | null;
    comments?: ReviewComment[];
    showComments?: boolean;
    showCommentButton?: boolean;
    activeComment?: ActiveComment | null;
    onStartComment?: (ac: ActiveComment | null) => void;
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
}: SvgDiffProps) {
    const [mode, setMode] = useState<ViewMode>("rendered");
    const [oldContent, setOldContent] = useState<string | null>(null);
    const [newContent, setNewContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [oldError, setOldError] = useState(false);
    const [newError, setNewError] = useState(false);

    useEffect(() => {
        async function fetchContents() {
            setLoading(true);

            if (oldContentUrl) {
                try {
                    const res = await fetch(oldContentUrl);
                    if (res.ok) {
                        setOldContent(await res.text());
                    } else {
                        setOldError(true);
                    }
                } catch {
                    setOldError(true);
                }
            } else {
                setOldContent(null);
            }

            if (newContentUrl) {
                try {
                    const res = await fetch(newContentUrl);
                    if (res.ok) {
                        setNewContent(await res.text());
                    } else {
                        setNewError(true);
                    }
                } catch {
                    setNewError(true);
                }
            } else {
                setNewContent(null);
            }

            setLoading(false);
        }
        fetchContents();
    }, [oldContentUrl, newContentUrl]);

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
        return (
            <iframe
                className="w-full overflow-hidden"
                sandbox=""
                srcDoc={buildSvgSrcDoc(content)}
                style={{
                    height: "60vh",
                    maxHeight: "600px",
                    minHeight: "200px",
                }}
                title={title}
            />
        );
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
            <div className="flex items-center justify-center gap-1 border-border border-t bg-surface-secondary px-4 py-1.5">
                {modes.map(({ icon: Icon, label, value }) => (
                    <button
                        className={`cursor-pointer rounded px-2 py-1 font-medium text-xs transition-colors ${
                            mode === value
                                ? "bg-surface-selected text-gray-800 dark:text-zinc-200"
                                : "text-text-tertiary hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                        }`}
                        key={value}
                        onClick={() => setMode(value)}
                        title={label}
                        type="button"
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                ))}
            </div>
        </div>
    );
}
