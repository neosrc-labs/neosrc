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

interface IssueCommentFormProps {
    owner: string;
    repo: string;
    number: number;
    disabled?: boolean;
    canClose?: boolean;
    canReopen?: boolean;
}

export function IssueCommentForm({
    owner,
    repo,
    number,
    disabled,
    canClose = false,
    canReopen = false,
}: IssueCommentFormProps) {
    const commentKey = `issue-autosave:comment:${owner}:${repo}:${number}`;
    const [body, setBody] = useState(() => readAutosave(commentKey) ?? "");
    const { clear: clearComment } = useAutosave(commentKey, body);
    const router = useRouter();
    const utils = api.useUtils();
    const { data: currentUserData } = api.users.currentUser.useQuery();

    const timelineInput = {
        owner,
        repo,
        issueNumber: number,
        limit: TIMELINE_PAGE_SIZE,
    };

    const addComment = api.issues.addComment.useMutation({
        onMutate: async ({ body }) => {
            await utils.issues.timeline.cancel(timelineInput);

            const prevData =
                utils.issues.timeline.getInfiniteData(timelineInput);

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

                utils.issues.timeline.setInfiniteData(timelineInput, (old) => {
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
                });
            }

            setBody("");
            return { prevData };
        },
        onError: (_err, { body }, ctx) => {
            if (ctx?.prevData) {
                utils.issues.timeline.setInfiniteData(
                    timelineInput,
                    ctx.prevData,
                );
            }
            setBody(body);
        },
        onSuccess: () => {
            clearComment();
        },
        onSettled: () => {
            utils.issues.timeline.invalidate(timelineInput);
            router.refresh();
        },
    });

    const closeMutation = api.issues.close.useMutation({
        onSuccess: () => {
            clearComment();
            utils.issues.timeline.invalidate(timelineInput);
            router.refresh();
        },
    });
    const reopenMutation = api.issues.reopen.useMutation({
        onSuccess: () => {
            clearComment();
            utils.issues.timeline.invalidate(timelineInput);
            router.refresh();
        },
    });

    const handleSubmit = useCallback(() => {
        if (!body.trim()) return;
        addComment.mutate({ owner, repo, issueNumber: number, body });
    }, [body, owner, repo, number, addComment]);

    const handleClose = useCallback(() => {
        const trimmed = body.trim();
        closeMutation.mutate({
            owner,
            repo,
            issueNumber: number,
            ...(trimmed ? { body } : {}),
        });
    }, [body, owner, repo, number, closeMutation]);

    const handleReopen = useCallback(() => {
        const trimmed = body.trim();
        reopenMutation.mutate({
            owner,
            repo,
            issueNumber: number,
            ...(trimmed ? { body } : {}),
        });
    }, [body, owner, repo, number, reopenMutation]);

    if (disabled) {
        return (
            <div className="mt-6 border-gray-200 border-t pt-6">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-text-tertiary">
                    <Lock size={14} />
                    <span>
                        This issue is locked. Only collaborators can comment.
                    </span>
                </div>
            </div>
        );
    }

    const stateAction: FooterAction | null = canClose
        ? {
              label: body.trim() ? "Close with comment" : "Close issue",
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
                label: body.trim() ? "Reopen and comment" : "Reopen issue",
                onClick: handleReopen,
                variant: "outline",
                disabled: () => reopenMutation.isPending,
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
                    Failed to close issue. Please try again.
                </p>
            )}
            {reopenMutation.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to reopen issue. Please try again.
                </p>
            )}
        </div>
    );
}
