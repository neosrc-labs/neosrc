"use client";

import type { FooterAction } from "./markdown/markdown-editor";
import { MarkdownEditor } from "./markdown/markdown-editor";

export function FileCommentEditor({
    open,
    value,
    onChange,
    onCancel,
    footerActions,
    disabled,
    error,
    owner,
    repo,
}: {
    open: boolean;
    value: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    footerActions: FooterAction[];
    disabled: boolean;
    error: boolean;
    owner: string;
    repo: string;
}) {
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
