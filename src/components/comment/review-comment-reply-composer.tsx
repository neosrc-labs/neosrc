"use client";

import { MarkdownEditor } from "../markdown/markdown-editor";

export interface ReviewCommentReplyComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    isPending: boolean;
    isError: boolean;
    owner: string;
    repo: string;
    placeholder: string;
}

export function ReviewCommentReplyComposer({
    value,
    onChange,
    onSubmit,
    onCancel,
    isPending,
    isError,
    owner,
    repo,
    placeholder,
}: ReviewCommentReplyComposerProps) {
    return (
        <div className="max-w-[880px] p-2">
            <MarkdownEditor
                autoFocus
                disabled={isPending}
                onChange={onChange}
                onCancel={onCancel}
                placeholder={placeholder}
                value={value}
                owner={owner}
                repo={repo}
                footerActions={[
                    {
                        label: "Reply",
                        onClick: () => {
                            if (value.trim()) onSubmit();
                        },
                        variant: "approve",
                        disabled: (text: string) => !text.trim(),
                    },
                ]}
            />
            {isError && (
                <p className="mt-1 text-danger-text text-xs">
                    Failed to post reply. Please try again.
                </p>
            )}
        </div>
    );
}

export function ReplyTextboxButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex w-full cursor-text items-center rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-text-muted text-xs transition-colors duration-200 hover:border-ring"
            onClick={onClick}
        >
            Reply...
        </button>
    );
}
