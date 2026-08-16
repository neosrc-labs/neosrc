"use client";

import type { FooterAction } from "~/components/markdown/markdown-editor";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";

export function DiffLineCommentEditor({
    value,
    onChange,
    onCancel,
    footerActions,
    isPending,
    isError,
    owner,
    repo,
}: {
    value: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    footerActions?: FooterAction[];
    isPending: boolean;
    isError: boolean;
    owner: string;
    repo: string;
}) {
    return (
        <div className="max-w-[800px] p-2">
            <MarkdownEditor
                autoFocus
                disabled={isPending}
                onChange={onChange}
                onCancel={onCancel}
                placeholder="Add a comment..."
                value={value}
                owner={owner}
                repo={repo}
                footerActions={footerActions}
            />
            {isError && (
                <p className="mt-1 text-red-600 text-xs">
                    Failed to post comment. Please try again.
                </p>
            )}
        </div>
    );
}
