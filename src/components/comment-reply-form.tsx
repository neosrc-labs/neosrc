"use client";

import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import { ResolveButton } from "~/components/resolved-thread-banner";

interface CommentReplyFormProps {
    value: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
    isPending: boolean;
    isError: boolean;
    owner: string;
    repo: string;
}

export function CommentReplyForm({
    value,
    onChange,
    onCancel,
    onSubmit,
    isPending,
    isError,
    owner,
    repo,
}: CommentReplyFormProps) {
    return (
        <>
            <MarkdownEditor
                autoFocus
                disabled={isPending}
                onChange={onChange}
                onCancel={onCancel}
                placeholder="Write a reply..."
                value={value}
                owner={owner}
                repo={repo}
                footerActions={[
                    {
                        label: "Reply",
                        onClick: onSubmit,
                        variant: "approve",
                        disabled: (text: string) => !text.trim(),
                    },
                ]}
            />
            {isError && (
                <p className="mt-1 text-red-600 text-xs">
                    Failed to post reply. Please try again.
                </p>
            )}
        </>
    );
}

interface ThreadReplyBarProps {
    onReply: () => void;
    onResolve: () => void;
    resolvePending: boolean;
    isUnresolve: boolean;
}

export function ThreadReplyBar({
    onReply,
    onResolve,
    resolvePending,
    isUnresolve,
}: ThreadReplyBarProps) {
    return (
        <div className="flex w-full items-center gap-2 px-6 py-2">
            <div className="min-w-0 flex-1">
                <ReplyTextboxButton onClick={onReply} />
            </div>
            <ResolveButton
                onClick={onResolve}
                isPending={resolvePending}
                isUnresolve={isUnresolve}
            />
        </div>
    );
}

export function ReplyTextboxButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-surface-elevated px-3 py-1.5 text-text-muted text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:hover:border-zinc-400"
            onClick={onClick}
        >
            Reply...
        </button>
    );
}
