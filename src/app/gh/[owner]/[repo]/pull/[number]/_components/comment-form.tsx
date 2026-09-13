"use client";

import { GitPullRequestClosed, Lock, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
    type FooterAction,
    MarkdownEditor,
} from "~/components/markdown/markdown-editor";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { api } from "~/trpc/react";
import {
    canInteract,
    type PullRequestPermissionContext,
} from "../permissions-utils";
import {
    buildOptimisticComment,
    type TimelineCacheData,
    useTimelineListCache,
} from "./timeline/use-timeline-comment-actions";

interface CommentFormProps {
    owner: string;
    repo: string;
    number: number;
    kind?: "pull" | "issue";
    permissionContext: PullRequestPermissionContext;
    canClose?: boolean;
    canReopen?: boolean;
    branchExists?: boolean;
}

export function CommentForm({
    owner,
    repo,
    number,
    kind = "pull",
    permissionContext,
    canClose = false,
    canReopen = false,
    branchExists = true,
}: CommentFormProps) {
    const isIssue = kind === "issue";
    const noun = isIssue ? "issue" : "pull request";
    const commentKey = `${isIssue ? "issue" : "pr"}-autosave:comment:${owner}:${repo}:${number}`;
    const [body, setBody] = useState(() => readAutosave(commentKey) ?? "");
    const { clear: clearComment } = useAutosave(commentKey, body);
    const router = useRouter();
    const utils = api.useUtils();
    const { data: currentUserData } = api.users.currentUser.useQuery();

    const cache = useTimelineListCache(
        isIssue
            ? { owner, repo, issueNumber: number }
            : { owner, repo, number },
    );

    const addCommentHandlers = {
        onMutate: async ({ body }: { body: string }) => {
            await cache.cancel();

            const prevData = cache.get();

            if (currentUserData?.login && currentUserData.avatarUrl) {
                const comment = buildOptimisticComment(body, {
                    login: currentUserData.login,
                    avatarUrl: currentUserData.avatarUrl,
                });
                cache.set((old) => {
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
        onError: (
            _err: unknown,
            { body }: { body: string },
            ctx: { prevData: TimelineCacheData | undefined } | undefined,
        ) => {
            if (ctx?.prevData) {
                cache.set(() => ctx.prevData);
            }
            setBody(body);
        },
        onSuccess: () => {
            clearComment();
        },
        onSettled: () => {
            cache.invalidate();
            router.refresh();
        },
    };

    const pullsAdd = api.pulls.addComment.useMutation(addCommentHandlers);
    const issuesAdd = api.issues.addComment.useMutation(addCommentHandlers);
    const addComment = isIssue ? issuesAdd : pullsAdd;

    const pullsClose = api.pulls.close.useMutation({
        onSuccess: () => {
            clearComment();
            cache.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });
    const issuesClose = api.issues.close.useMutation({
        onSuccess: () => {
            clearComment();
            cache.invalidate();
            router.refresh();
        },
    });
    const closeMutation = isIssue ? issuesClose : pullsClose;

    const pullsReopen = api.pulls.reopen.useMutation({
        onSuccess: () => {
            clearComment();
            cache.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });
    const issuesReopen = api.issues.reopen.useMutation({
        onSuccess: () => {
            clearComment();
            cache.invalidate();
            router.refresh();
        },
    });
    const reopenMutation = isIssue ? issuesReopen : pullsReopen;

    const handleSubmit = useCallback(() => {
        if (!body.trim()) return;
        if (isIssue) {
            issuesAdd.mutate({ owner, repo, issueNumber: number, body });
        } else {
            pullsAdd.mutate({ owner, repo, number, body });
        }
    }, [body, owner, repo, number, isIssue, issuesAdd, pullsAdd]);

    const handleClose = useCallback(() => {
        const trimmed = body.trim();
        if (isIssue) {
            issuesClose.mutate({
                owner,
                repo,
                issueNumber: number,
                ...(trimmed ? { body } : {}),
            });
        } else {
            pullsClose.mutate({
                owner,
                repo,
                number,
                ...(trimmed ? { body } : {}),
            });
        }
    }, [body, owner, repo, number, isIssue, issuesClose, pullsClose]);

    const handleReopen = useCallback(() => {
        const trimmed = body.trim();
        if (isIssue) {
            issuesReopen.mutate({
                owner,
                repo,
                issueNumber: number,
                ...(trimmed ? { body } : {}),
            });
        } else {
            pullsReopen.mutate({
                owner,
                repo,
                number,
                ...(trimmed ? { body } : {}),
            });
        }
    }, [body, owner, repo, number, isIssue, issuesReopen, pullsReopen]);

    if (!canInteract(permissionContext)) {
        const { currentUser, isPullRequestLocked } = permissionContext;
        return (
            <div className="mt-6 border-gray-200 border-t pt-6">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-text-tertiary">
                    {isPullRequestLocked ? (
                        <Lock size={14} />
                    ) : (
                        <LogIn size={14} />
                    )}
                    <span>
                        {isPullRequestLocked
                            ? `This ${noun} is locked. Only collaborators can comment.`
                            : `Sign in to comment on this ${noun}.`}
                    </span>
                    {!currentUser && (
                        <a
                            href="/api/auth/signin"
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Sign in
                        </a>
                    )}
                </div>
            </div>
        );
    }

    const stateAction: FooterAction | null = canClose
        ? {
              label: body.trim() ? "Close with comment" : `Close ${noun}`,
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
                label: body.trim() ? "Reopen and comment" : `Reopen ${noun}`,
                onClick: handleReopen,
                variant: "outline",
                disabled: () => reopenMutation.isPending || !branchExists,
                tooltip:
                    !isIssue && !branchExists
                        ? "The head branch was deleted."
                        : undefined,
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
                    Failed to close {noun}. Please try again.
                </p>
            )}
            {reopenMutation.isError && (
                <p className="mt-2 text-red-600 text-sm">
                    Failed to reopen {noun}. Please try again.
                </p>
            )}
        </div>
    );
}
