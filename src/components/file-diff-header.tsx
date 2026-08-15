"use client";

import { FoldVertical, MessageSquare, UnfoldVertical } from "lucide-react";

export function FileDiffHeader({
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
}: {
    file: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
    };
    isCollapsed: boolean;
    isViewed: boolean;
    expandedAll: boolean;
    headerRef: React.RefObject<HTMLDivElement | null>;
    onToggleCollapsed: () => void;
    onToggleExpandAll: () => void;
    onToggleViewed: () => void;
    onToggleFileComment: () => void;
    isFileCommentOpen: boolean;
}) {
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
            className="sticky top-[64px] z-[1] flex items-center gap-2 rounded-t border-border border-b bg-surface-secondary px-4 py-2"
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
                        className="ml-1 flex shrink-0 cursor-pointer items-center text-text-tertiary"
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
            <label className="flex cursor-pointer items-center gap-1 text-text-secondary text-xs">
                <input
                    checked={isViewed}
                    className="cursor-pointer rounded border-gray-300 dark:border-zinc-600"
                    onChange={onToggleViewed}
                    type="checkbox"
                />
                Viewed
            </label>
            <button
                className="flex shrink-0 cursor-pointer items-center text-text-tertiary"
                onClick={onToggleFileComment}
                type="button"
                title={isFileCommentOpen ? "Cancel" : "Comment on file"}
            >
                <MessageSquare size={14} />
            </button>
        </div>
    );
}
