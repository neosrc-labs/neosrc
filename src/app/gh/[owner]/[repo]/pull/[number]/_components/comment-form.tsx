"use client";

import { GitPullRequestClosed, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
    type FooterAction,
    MarkdownEditor,
} from "~/components/markdown/markdown-editor";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { GQLIssueComment } from "~/server/github-graphql";
import { api } from "~/trpc/react";

interface CommentFormProps {
    owner: string;
    repo: string;
    number: number;
    disabled?: boolean;
    canClose?: boolean;
    canReopen?: boolean;
    branchExists?: boolean;
}

export function CommentForm({
    owner,
    repo,
    number,
    disabled,
    canClose = false,
    canReopen = false,
    branchExists = true,
}: CommentFormProps) {
    const commentKey = `pr-autosave:comment:${owner}:${repo}:${number}`;
    const [body, setBody] = useState(() => readAutosave(commentKey) ?? "");
    const { clear: clearComment } = useAutosave(commentKey, body);
    const router = useRouter();
    const utils = api.useUtils();
    const { data: currentUserData } = api.users.currentUser.useQuery();

    const addComment = api.pulls.addComment.useMutation({
        onMutate: async ({ body }) => {
            await utils.timeline.list.cancel({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });

            const prevData = utils.timeline.list.getInfiniteData({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });

            if (currentUserData?.login && currentUserData.avatarUrl) {
                const now = new Date().toISOString();
                const tempId = -Date.now();
                const comment: GQLIssueComment = {
                    __typename: "IssueComment",
                    id: `optimistic-issue-comment-${Math.abs(tempId)}`,
                    databaseId: tempId,
                    body,
                    author: {
                        __typename: "User",
                        login: currentUserData.login,
                        avatarUrl: currentUserData.avatarUrl,
                        url: `https://github.com/${currentUserData.login}`,
                    },
                    createdAt: now,
                    authorAssociation: "NONE",
                    isMinimized: false,
                    minimizedReason: null,
                    reactions: { nodes: [] },
                };

                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page, index) =>
                                index === old.pages.length - 1
                                    ? {
                                          ...page,
                                          events: [...page.events, comment],
                                      }
                                    : page,
                            ),
                        };
                    },
                );
            }

            setBody("");
            return { prevData };
        },
        onError: (_err, { body }, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    ctx.prevData,
                );
            }
            setBody(body);
        },
        onSuccess: () => {
            clearComment();
        },
        onSettled: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            router.refresh();
        },
    });

    const closeMutation = api.pulls.close.useMutation({
        onSuccess: () => {
            clearComment();
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });
    const reopenMutation = api.pulls.reopen.useMutation({
        onSuccess: () => {
            clearComment();
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const handleSubmit = useCallback(() => {
        if (!body.trim()) return;
        addComment.mutate({ owner, repo, number, body });
    }, [body, owner, repo, number, addComment]);

    const handleClose = useCallback(() => {
        const trimmed = body.trim();
        closeMutation.mutate({
            owner,
            repo,
            number,
            ...(trimmed ? { body } : {}),
        });
    }, [body, owner, repo, number, closeMutation]);

    const handleReopen = useCallback(() => {
        const trimmed = body.trim();
        reopenMutation.mutate({
            owner,
            repo,
            number,
            ...(trimmed ? { body } : {}),
        });
    }, [body, owner, repo, number, reopenMutation]);

    if (disabled) {
        return (
            <div className="mt-6 border-gray-200 border-t pt-6">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-text-tertiary">
                    <Lock size={14} />
                    <span>
                        This pull request is locked. Only collaborators can
                        comment.
                    </span>
                </div>
            </div>
        );
    }

    const stateAction: FooterAction | null = canClose
        ? {
              label: body.trim() ? "Close with comment" : "Close pull request",
              onClick: handleClose,
              variant: "outline",
              disabled: () => closeMutation.isPending,
              icon: (
                  <GitPullRequestClosed
                      className="text-state-closed"
                      size={16}
                  />
              ),
          }
        : canReopen
          ? {
                label: body.trim()
                    ? "Reopen and comment"
                    : "Reopen pull request",
                onClick: handleReopen,
                variant: "outline",
                disabled: () => reopenMutation.isPending || !branchExists,
                tooltip: branchExists
                    ? undefined
                    : "The head branch was deleted.",
            }
          : null;

    const footerActions: FooterAction[] = [
        ...(stateAction ? [stateAction] : []),
        {
            label: "Comment",
            onClick: () => handleSubmit(),
            variant: "approve",
            disabled: (text: string) => !text.trim(),
        },
    ];

    return (
        <div className="mt-6 border-gray-200 border-t pt-6">
            <h3 className="mb-3 text-text-primary">Add a comment</h3>
            <MarkdownEditor
                disabled={
                    addComment.isPending ||
                    closeMutation.isPending ||
                    reopenMutation.isPending
                }
                onChange={setBody}
                placeholder="Leave a comment"
                value={body}
                owner={owner}
                repo={repo}
                footerActions={footerActions}
            />
            {addComment.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to post comment. Please try again.
                </p>
            )}
            {closeMutation.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to close pull request. Please try again.
                </p>
            )}
            {reopenMutation.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to reopen pull request. Please try again.
                </p>
            )}
        </div>
    );
}
