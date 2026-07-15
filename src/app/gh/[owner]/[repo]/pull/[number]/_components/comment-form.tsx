"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { api } from "~/trpc/react";

interface CommentFormProps {
    owner: string;
    repo: string;
    number: number;
    disabled?: boolean;
}

export function CommentForm({
    owner,
    repo,
    number,
    disabled,
}: CommentFormProps) {
    const [body, setBody] = useState("");
    const router = useRouter();
    const utils = api.useUtils();

    const addComment = api.pulls.addComment.useMutation({
        onSuccess: () => {
            setBody("");
            utils.timeline.list.invalidate();
            router.refresh();
        },
    });

    const handleSubmit = useCallback(() => {
        if (!body.trim()) return;
        addComment.mutate({ owner, repo, number, body });
    }, [body, owner, repo, number, addComment]);

    if (disabled) {
        return (
            <div className="mt-6 border-gray-200 border-t pt-6">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-text-tertiary dark:border-zinc-700 dark:bg-zinc-900">
                    <Lock size={14} />
                    <span>
                        This pull request is locked. Only collaborators can
                        comment.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6 border-gray-200 border-t pt-6">
            <h3 className="mb-3 text-text-primary">Add a comment</h3>
            <MarkdownEditor
                disabled={addComment.isPending}
                onChange={setBody}
                placeholder="Leave a comment"
                value={body}
                owner={owner}
                repo={repo}
                footerActions={[
                    {
                        label: "Comment",
                        onClick: () => handleSubmit(),
                        variant: "approve",
                        disabled: (text: string) => !text.trim(),
                    },
                ]}
            />
            {addComment.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to post comment. Please try again.
                </p>
            )}
        </div>
    );
}
