"use client";

import type { components } from "@octokit/openapi-types";
import { ChevronDown, SquarePen } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { DiffView } from "~/components/DiffView";
import { ReplyTextboxButton } from "~/components/InlineCommentThread";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import { ResolveButton } from "~/components/ResolvedThreadBanner";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import {
    applyReviewThreadOperations,
    useReviewThreadOperations,
} from "~/hooks/use-review-thread-operations";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

type Reaction = components["schemas"]["reaction"];

interface ReviewCommentsProps {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    state?: string;
    allComments: ReviewComment[];
    currentUserLogin: string;
    canInteract: boolean;
}

export function ReviewComments({
    owner,
    repo,
    number,
    reviewId,
    state,
    allComments,
    currentUserLogin,
    canInteract,
}: ReviewCommentsProps) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const [expandedResolvedIds, setExpandedResolvedIds] = useState<Set<number>>(
        new Set(),
    );

    const { data: threads } = api.reviewComments.threads.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const resolveOps = useReviewThreadOperations({ owner, repo, number });
    const displayThreads = applyReviewThreadOperations(
        threads,
        resolveOps.operations,
    );

    const threadByCommentId = useMemo(() => {
        const map = new Map<
            number,
            NonNullable<typeof displayThreads>[number]
        >();
        if (!displayThreads) return map;
        for (const thread of displayThreads) {
            for (const c of thread.comments) {
                map.set(c.id, thread);
            }
        }
        return map;
    }, [displayThreads]);

    const handleResolve = useCallback(
        (commentId: number, threadId: string, resolve: boolean) => {
            setExpandedResolvedIds((prev) => {
                const next = new Set(prev);
                next.delete(commentId);
                return next;
            });
            resolveOps.resolve({
                threadId,
                resolve,
            });
        },
        [resolveOps.resolve],
    );

    const allCommentIds = useMemo(() => {
        const topLevelIds = new Set<number>();
        const ids: number[] = [];
        for (const c of allComments) {
            if (!c.in_reply_to_id && c.pull_request_review_id === reviewId) {
                topLevelIds.add(c.id);
                ids.push(c.id);
            }
        }
        for (const c of allComments) {
            if (c.in_reply_to_id && topLevelIds.has(c.in_reply_to_id)) {
                ids.push(c.id);
            }
        }
        return ids;
    }, [allComments, reviewId]);

    const { data: reactionMap = {} } =
        api.reactions.getForReviewComments.useQuery(
            { owner, repo, commentIds: allCommentIds },
            { enabled: allCommentIds.length > 0, staleTime: 30_000 },
        );

    const updateMutation = api.reviewComments.update.useMutation({
        onMutate: ({ commentId, body }) => {
            setSavedBodies((prev) => ({ ...prev, [commentId]: body }));
            setEditingCommentId(null);
        },
        onError: (_, { commentId }) => {
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
            setEditingCommentId(commentId);
        },
    });

    const reactMutation = useTogglePullRequestReviewCommentReaction(
        owner,
        repo,
        allCommentIds,
        currentUserLogin,
    );

    const handleReact = (commentId: number, content: ReactionContent) => {
        reactMutation.mutate({ owner, repo, commentId, content });
    };

    const handleSaveEdit = (commentId: number) => {
        if (!editBody.trim()) return;
        updateMutation.mutate({ owner, repo, commentId, body: editBody });
    };

    const replyMap = useMemo(() => {
        const map = new Map<number, ReviewComment[]>();
        for (const comment of allComments) {
            if (comment.in_reply_to_id) {
                const existing = map.get(comment.in_reply_to_id) ?? [];
                existing.push(comment);
                map.set(comment.in_reply_to_id, existing);
            }
        }
        return map;
    }, [allComments]);

    if (allComments.length === 0) {
        return null;
    }

    const topLevel = allComments.filter(
        (c) => !c.in_reply_to_id && c.pull_request_review_id === reviewId,
    );

    if (topLevel.length === 0) {
        return null;
    }

    const byPath: Record<string, ReviewComment[]> = {};
    for (const comment of topLevel) {
        const path = comment.path;
        if (!byPath[path]) byPath[path] = [];
        byPath[path].push(comment);
    }

    return (
        <div className="space-y-3 pt-3">
            {Object.entries(byPath).map(([path, fileComments]) => {
                const resolvedInFile = fileComments.filter(
                    (c) => threadByCommentId.get(c.id)?.isResolved,
                );
                const outdatedInFile = fileComments.some((c) => {
                    const t = threadByCommentId.get(c.id);
                    return t?.isOutdated && !t.isResolved;
                });

                return (
                    <div
                        key={path}
                        className="mt-3 rounded border border-gray-200 dark:border-zinc-700"
                    >
                        <div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                            <span className="flex-1 truncate font-mono text-gray-700 text-xs dark:text-gray-300">
                                {path}
                            </span>
                            {resolvedInFile.length > 0 && (
                                <span className="font-sans text-gray-500 text-xs dark:text-zinc-400">
                                    Resolved
                                </span>
                            )}
                            <div className="flex items-center gap-2">
                                {outdatedInFile && (
                                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                        Outdated
                                    </span>
                                )}
                                {resolvedInFile.length > 0 && (
                                    <div className="flex gap-1">
                                        {resolvedInFile.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                aria-expanded={expandedResolvedIds.has(
                                                    c.id,
                                                )}
                                                onClick={() =>
                                                    setExpandedResolvedIds(
                                                        (prev) => {
                                                            const next =
                                                                new Set(prev);
                                                            if (
                                                                next.has(c.id)
                                                            ) {
                                                                next.delete(
                                                                    c.id,
                                                                );
                                                            } else {
                                                                next.add(c.id);
                                                            }
                                                            return next;
                                                        },
                                                    )
                                                }
                                                className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-gray-500 text-xs transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                                            >
                                                <ChevronDown
                                                    size={14}
                                                    className={
                                                        expandedResolvedIds.has(
                                                            c.id,
                                                        )
                                                            ? "rotate-180"
                                                            : ""
                                                    }
                                                />
                                                Show thread
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200 overflow-hidden rounded-b dark:divide-zinc-700">
                            {fileComments.map((comment) => {
                                const thread = threadByCommentId.get(
                                    comment.id,
                                );
                                const isResolved = thread?.isResolved ?? false;
                                const isExpanded = expandedResolvedIds.has(
                                    comment.id,
                                );

                                return (
                                    <CommentBlock
                                        key={comment.id}
                                        comment={comment}
                                        replies={replyMap.get(comment.id) ?? []}
                                        owner={owner}
                                        repo={repo}
                                        number={number}
                                        state={state}
                                        canInteract={canInteract}
                                        currentUserLogin={currentUserLogin}
                                        reactionMap={reactionMap}
                                        editingCommentId={editingCommentId}
                                        editBody={editBody}
                                        savedBodies={savedBodies}
                                        isResolved={isResolved}
                                        isExpanded={isExpanded}
                                        threadId={thread?.id ?? ""}
                                        isResolvePending={resolveOps.isPending}
                                        onStartEdit={(id, body) => {
                                            setEditBody(body);
                                            setEditingCommentId(id);
                                        }}
                                        onEditBodyChange={setEditBody}
                                        onCancelEdit={() => {
                                            setEditingCommentId(null);
                                            setEditBody("");
                                        }}
                                        onSaveEdit={handleSaveEdit}
                                        onReact={handleReact}
                                        onResolve={handleResolve}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function truncateDiffToRange(
    diffHunk: string,
    startLine: number | null | undefined,
    endLine: number | null | undefined,
): string {
    if (!startLine || !endLine || startLine >= endLine) return diffHunk;
    const lines = diffHunk.split("\n");
    const headerLine = lines[0];
    if (!headerLine?.startsWith("@@")) return diffHunk;

    const match = headerLine.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
    );
    if (!match) return diffHunk;

    const newStart = parseInt(match[3] ?? "0", 10);
    let newLine = newStart;
    let oldLine = parseInt(match[1] ?? "0", 10);
    const filtered: string[] = [];
    let newOldLine = 0;
    let newNewCount = 0;
    let newOldCount = 0;
    let started = false;

    for (let i = 1; i < lines.length; i++) {
        const ln = lines[i];
        if (ln === undefined) continue;
        const first = ln[0] ?? "";

        if (first === " ") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newOldCount++;
                newNewCount++;
            }
            oldLine++;
            newLine++;
        } else if (first === "-") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newOldCount++;
            }
            oldLine++;
        } else if (first === "+") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newNewCount++;
            }
            newLine++;
        } else if (first === "\\") {
            if (filtered.length > 0) filtered.push(ln);
        }
    }

    if (filtered.length === 0) return diffHunk;
    if (!started) return diffHunk;

    newOldLine = Math.max(1, newOldLine);
    const newHeader = `@@ -${newOldLine},${newOldCount} +${startLine},${newNewCount} @@`;
    return [newHeader, ...filtered].join("\n");
}

function CommentBlock({
    comment,
    replies,
    owner,
    repo,
    number,
    state,
    canInteract,
    currentUserLogin,
    reactionMap,
    editingCommentId,
    editBody,
    savedBodies,
    isResolved,
    isExpanded,
    threadId,
    isResolvePending,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onReact,
    onResolve,
}: {
    comment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    state?: string;
    canInteract: boolean;
    currentUserLogin: string;
    reactionMap: Record<number, Reaction[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    isResolved: boolean;
    isExpanded: boolean;
    threadId: string;
    isResolvePending: (threadId: string) => boolean;
    onStartEdit: (commentId: number, body: string) => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (commentId: number) => void;
    onReact: (commentId: number, content: ReactionContent) => void;
    onResolve: (commentId: number, threadId: string, resolve: boolean) => void;
}) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyBody, setReplyBody] = useState("");
    const utils = api.useUtils();

    const replyMutation = api.reviewComments.reply.useMutation({
        onSuccess: () => {
            setReplyBody("");
            setShowReplyForm(false);
            utils.reviewComments.invalidate();
        },
    });

    if (!comment.user) {
        return null;
    }

    if (isResolved && !isExpanded) {
        return <div id={`review-thread-${comment.id}`} />;
    }

    const parentReactions = reactionMap[comment.id] ?? [];

    return (
        <div
            id={`review-thread-${comment.id}`}
            className="bg-gray-50 dark:bg-zinc-950"
        >
            {comment.diff_hunk && (
                <div>
                    <DiffView
                        patch={truncateDiffToRange(
                            comment.diff_hunk,
                            comment.start_line ??
                                (comment.line != null
                                    ? Math.max(1, comment.line - 5)
                                    : null),
                            comment.line,
                        )}
                        filename={comment.path}
                    />
                </div>
            )}
            <CommentCard
                user={comment.user}
                createdAt={comment.created_at}
                authorAssociation={comment.author_association}
                isPending={state === "pending"}
                owner={owner}
                repo={repo}
                isEditing={editingCommentId === comment.id}
                editBody={editingCommentId === comment.id ? editBody : ""}
                onEditBodyChange={onEditBodyChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={() => onSaveEdit(comment.id)}
                headerActions={
                    <>
                        <ReactionPicker
                            disabled={!canInteract}
                            reactions={parentReactions}
                            currentUserLogin={currentUserLogin}
                            onReact={(content) => onReact(comment.id, content)}
                        />
                        {comment.user?.login === currentUserLogin &&
                            canInteract && (
                                <button
                                    type="button"
                                    aria-label="Edit comment"
                                    className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                    onClick={() =>
                                        onStartEdit(
                                            comment.id,
                                            savedBodies[comment.id] ??
                                                comment.body,
                                        )
                                    }
                                >
                                    <SquarePen size={14} />
                                </button>
                            )}
                    </>
                }
                footer={
                    parentReactions.length > 0 && (
                        <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                            <ReactionBar
                                disabled={!canInteract}
                                reactions={parentReactions}
                                currentUserLogin={currentUserLogin}
                                onReact={(content) =>
                                    onReact(comment.id, content)
                                }
                            />
                        </div>
                    )
                }
            >
                <MarkdownRenderer
                    content={savedBodies[comment.id] ?? comment.body}
                    owner={owner}
                    repo={repo}
                    pullNumber={number}
                    commentPath={comment.path}
                    commentLine={comment.line}
                    commentStartLine={comment.start_line}
                    commentThreadId={threadId}
                />
            </CommentCard>
            {replies.map((reply) => {
                if (!reply.user) return null;
                const replyReactions = reactionMap[reply.id] ?? [];
                return (
                    <div key={reply.id} className="mt-2 pl-3">
                        <CommentCard
                            user={reply.user}
                            createdAt={reply.created_at}
                            authorAssociation={reply.author_association}
                            owner={owner}
                            repo={repo}
                            variant="nested"
                            isEditing={editingCommentId === reply.id}
                            editBody={
                                editingCommentId === reply.id ? editBody : ""
                            }
                            onEditBodyChange={onEditBodyChange}
                            onCancelEdit={onCancelEdit}
                            onSaveEdit={() => onSaveEdit(reply.id)}
                            headerActions={
                                <>
                                    <ReactionPicker
                                        disabled={!canInteract}
                                        reactions={replyReactions}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            onReact(reply.id, content)
                                        }
                                    />
                                    {reply.user?.login === currentUserLogin &&
                                        canInteract && (
                                            <button
                                                type="button"
                                                aria-label="Edit comment"
                                                className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                                onClick={() =>
                                                    onStartEdit(
                                                        reply.id,
                                                        savedBodies[reply.id] ??
                                                            reply.body,
                                                    )
                                                }
                                            >
                                                <SquarePen size={14} />
                                            </button>
                                        )}
                                </>
                            }
                            footer={
                                replyReactions.length > 0 && (
                                    <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                        <ReactionBar
                                            disabled={!canInteract}
                                            reactions={replyReactions}
                                            currentUserLogin={currentUserLogin}
                                            onReact={(content) =>
                                                onReact(reply.id, content)
                                            }
                                        />
                                    </div>
                                )
                            }
                        >
                            <MarkdownRenderer
                                content={savedBodies[reply.id] ?? reply.body}
                                owner={owner}
                                repo={repo}
                                pullNumber={number}
                                commentPath={comment.path}
                                commentLine={comment.line}
                                commentStartLine={comment.start_line}
                                commentThreadId={threadId}
                            />
                        </CommentCard>
                    </div>
                );
            })}
            {canInteract ? (
                showReplyForm ? (
                    <div className="bg-gray-50 p-2 dark:bg-zinc-950">
                        <MarkdownEditor
                            autoFocus
                            disabled={replyMutation.isPending}
                            onChange={setReplyBody}
                            onCancel={() => {
                                setShowReplyForm(false);
                                setReplyBody("");
                            }}
                            placeholder="Write a reply..."
                            value={replyBody}
                            owner={owner}
                            repo={repo}
                            footerActions={[
                                {
                                    label: "Reply",
                                    onClick: () => {
                                        if (!replyBody.trim()) return;
                                        replyMutation.mutate({
                                            owner,
                                            repo,
                                            number,
                                            body: replyBody,
                                            inReplyTo: comment.id,
                                        });
                                    },
                                    variant: "approve",
                                    disabled: (text: string) => !text.trim(),
                                },
                            ]}
                        />
                        {replyMutation.isError && (
                            <p className="mt-1 text-red-600 text-xs">
                                Failed to post reply. Please try again.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex w-full items-center gap-2 bg-gray-50 px-6 py-2 dark:bg-zinc-950">
                        <div className="min-w-0 flex-1">
                            <ReplyTextboxButton
                                onClick={() => setShowReplyForm(true)}
                            />
                        </div>
                        <ResolveButton
                            onClick={() =>
                                onResolve(comment.id, threadId, !isResolved)
                            }
                            isPending={isResolvePending(threadId)}
                            isUnresolve={isResolved}
                        />
                    </div>
                )
            ) : null}
        </div>
    );
}
