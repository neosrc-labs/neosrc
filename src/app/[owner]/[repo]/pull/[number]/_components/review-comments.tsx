"use client";

import type { components } from "@octokit/openapi-types";
import { Loader2, SmilePlus, SquarePen } from "lucide-react";
import { useMemo, useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { DiffView } from "~/components/DiffView";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

type Reaction = components["schemas"]["reaction"];

const allReactions = [
    "+1",
    "-1",
    "laugh",
    "confused",
    "heart",
    "hooray",
    "rocket",
    "eyes",
] as const;

const reactionEmojis: Record<string, string> = {
    "+1": "👍",
    "-1": "👎",
    laugh: "😄",
    confused: "😕",
    heart: "❤️",
    hooray: "🎉",
    rocket: "🚀",
    eyes: "👀",
};

const reactionOrder: (typeof allReactions)[number][] = [
    "+1",
    "heart",
    "laugh",
    "hooray",
    "confused",
    "rocket",
    "eyes",
    "-1",
];

interface ReviewCommentsProps {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    state?: string;
    allComments: ReviewComment[];
    currentUserLogin: string;
}

export function ReviewComments({
    owner,
    repo,
    number,
    reviewId,
    state,
    allComments,
    currentUserLogin,
}: ReviewCommentsProps) {
    const { data: comments, isLoading } =
        api.reviewComments.byReviewId.useQuery({
            owner,
            repo,
            number,
            reviewId,
        });

    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const utils = api.useUtils();

    const allCommentIds = useMemo(
        () => (comments ?? []).map((c) => c.id),
        [comments],
    );

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

    const reactMutation =
        api.reactions.togglePullRequestReviewComment.useMutation({
            onMutate: async ({ commentId, content }) => {
                await utils.reactions.getForReviewComments.cancel({
                    owner,
                    repo,
                    commentIds: allCommentIds,
                });
                const prevData = utils.reactions.getForReviewComments.getData({
                    owner,
                    repo,
                    commentIds: allCommentIds,
                });
                utils.reactions.getForReviewComments.setData(
                    { owner, repo, commentIds: allCommentIds },
                    (old) => {
                        if (!old) return old;
                        const prevReactions: Reaction[] = old[commentId] ?? [];
                        const existing = prevReactions.find(
                            (r) =>
                                r.user?.login === currentUserLogin &&
                                r.content === content,
                        );
                        const updatedReactions = existing
                            ? prevReactions.filter((r) => r.id !== existing.id)
                            : [
                                  ...prevReactions,
                                  {
                                      id: -Date.now(),
                                      node_id: "",
                                      user: {
                                          login: currentUserLogin,
                                          avatar_url: "",
                                          html_url: "",
                                          id: 0,
                                          node_id: "",
                                          gravatar_id: "",
                                          url: "",
                                          received_events_url: "",
                                          type: "User",
                                          site_admin: false,
                                      },
                                      content,
                                      created_at: new Date().toISOString(),
                                  } as Reaction,
                              ];
                        return { ...old, [commentId]: updatedReactions };
                    },
                );
                return { prevData };
            },
            onError: (_err, _vars, ctx) => {
                if (ctx?.prevData) {
                    utils.reactions.getForReviewComments.setData(
                        { owner, repo, commentIds: allCommentIds },
                        ctx.prevData,
                    );
                }
            },
            onSettled: () => {
                utils.reactions.getForReviewComments.invalidate({
                    owner,
                    repo,
                    commentIds: allCommentIds,
                });
            },
        });

    const handleReact = (
        commentId: number,
        content: (typeof allReactions)[number],
    ) => {
        reactMutation.mutate({ owner, repo, commentId, content });
    };

    const handleSaveEdit = (commentId: number) => {
        if (!editBody.trim()) return;
        updateMutation.mutate({ owner, repo, commentId, body: editBody });
    };

    if (isLoading) {
        return (
            <div className="mt-2 flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading review comments...
            </div>
        );
    }

    if (!comments || comments.length === 0) {
        return null;
    }

    const topLevel: ReviewComment[] = [];
    const replyMap = new Map<number, ReviewComment[]>();

    for (const comment of allComments) {
        if (comment.in_reply_to_id) {
            const existing = replyMap.get(comment.in_reply_to_id) ?? [];
            existing.push(comment);
            replyMap.set(comment.in_reply_to_id, existing);
        } else if (comment.pull_request_review_id === reviewId) {
            topLevel.push(comment);
        }
    }

    const byPath: Record<string, ReviewComment[]> = {};
    for (const comment of topLevel) {
        const path = comment.path;
        if (!byPath[path]) byPath[path] = [];
        byPath[path].push(comment);
    }

    return (
        <div className="space-y-3 pt-3">
            {Object.entries(byPath).map(([path, fileComments]) => (
                <div
                    key={path}
                    className="mt-3 overflow-hidden rounded border border-gray-200 dark:border-zinc-700"
                >
                    <div className="border-gray-200 border-b bg-gray-50 px-3 py-1.5 font-mono text-gray-600 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {path}
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {fileComments.map((comment) => (
                            <CommentBlock
                                key={comment.id}
                                comment={comment}
                                replies={replyMap.get(comment.id) ?? []}
                                owner={owner}
                                repo={repo}
                                number={number}
                                state={state}
                                currentUserLogin={currentUserLogin}
                                reactionMap={reactionMap}
                                editingCommentId={editingCommentId}
                                editBody={editBody}
                                savedBodies={savedBodies}
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
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CommentBlock({
    comment,
    replies,
    owner,
    repo,
    number,
    state,
    currentUserLogin,
    reactionMap,
    editingCommentId,
    editBody,
    savedBodies,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onReact,
}: {
    comment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    state?: string;
    currentUserLogin: string;
    reactionMap: Record<number, Reaction[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    onStartEdit: (commentId: number, body: string) => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (commentId: number) => void;
    onReact: (
        commentId: number,
        content: (typeof allReactions)[number],
    ) => void;
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

    const parentReactions = reactionMap[comment.id] ?? [];

    return (
        <div id={`review-thread-${comment.id}`}>
            {comment.diff_hunk && (
                <div>
                    <DiffView
                        patch={comment.diff_hunk}
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
                        <ReactionButton
                            commentId={comment.id}
                            reactions={parentReactions}
                            currentUserLogin={currentUserLogin}
                            onReact={onReact}
                        />
                        {comment.user?.login === currentUserLogin && (
                            <button
                                type="button"
                                className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                onClick={() =>
                                    onStartEdit(
                                        comment.id,
                                        savedBodies[comment.id] ?? comment.body,
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
                                    <ReactionButton
                                        commentId={reply.id}
                                        reactions={replyReactions}
                                        currentUserLogin={currentUserLogin}
                                        onReact={onReact}
                                    />
                                    {reply.user?.login === currentUserLogin && (
                                        <button
                                            type="button"
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
                            />
                        </CommentCard>
                    </div>
                );
            })}
            {showReplyForm ? (
                <div className="bg-gray-50 p-2 dark:bg-zinc-950">
                    <MarkdownEditor
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
                <div className="flex w-full bg-gray-50 px-6 py-2 dark:bg-zinc-950">
                    <button
                        type="button"
                        className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-400 text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-500 dark:hover:border-zinc-400"
                        onClick={() => setShowReplyForm(true)}
                    >
                        Reply...
                    </button>
                </div>
            )}
        </div>
    );
}

function ReactionButton({
    commentId: _commentId,
    reactions,
    currentUserLogin,
    onReact,
}: {
    commentId: number;
    reactions: Reaction[];
    currentUserLogin: string;
    onReact: (
        commentId: number,
        content: (typeof allReactions)[number],
    ) => void;
}) {
    const [open, setOpen] = useState(false);

    const hasNoUser = !currentUserLogin;

    const availableReactions = allReactions.filter(
        (c) =>
            !reactions.some(
                (r) => r.user?.login === currentUserLogin && r.content === c,
            ),
    );

    if (hasNoUser || availableReactions.length === 0) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                >
                    <SmilePlus size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-fit bg-white p-2 dark:bg-zinc-950"
                align="end"
            >
                <div className="flex gap-1">
                    {availableReactions.map((content) => (
                        <button
                            key={content}
                            type="button"
                            onClick={() => {
                                onReact(_commentId, content);
                                setOpen(false);
                            }}
                            className="cursor-pointer rounded p-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                        >
                            {reactionEmojis[content] ?? content}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ReactionBar({
    reactions,
    currentUserLogin,
    onReact,
}: {
    reactions: Reaction[];
    currentUserLogin: string;
    onReact: (content: (typeof allReactions)[number]) => void;
}) {
    const grouped = useMemo(() => {
        const map = new Map<string, Reaction[]>();
        for (const r of reactions) {
            const existing = map.get(r.content) ?? [];
            existing.push(r);
            map.set(r.content, existing);
        }
        return map;
    }, [reactions]);

    const entries = reactionOrder
        .map((content) => [content, grouped.get(content) ?? []] as const)
        .filter(([, rs]) => rs.length > 0);

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {entries.map(([content, rs]) => {
                const isActive = rs.some(
                    (r) => r.user?.login === currentUserLogin,
                );
                return (
                    <HoverCard key={content} openDelay={300}>
                        <HoverCardTrigger asChild>
                            <button
                                type="button"
                                onClick={() => onReact(content)}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs transition-colors ${
                                    isActive
                                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                        : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
                                }`}
                            >
                                <span>
                                    {reactionEmojis[content] ?? content}
                                </span>
                                <span>{rs.length}</span>
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-56 bg-white p-3 dark:bg-zinc-950">
                            <div className="flex flex-col gap-2">
                                {rs.map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex items-center gap-2 text-gray-700 text-sm dark:text-gray-300"
                                    >
                                        {r.user && (
                                            <img
                                                src={r.user.avatar_url}
                                                alt={r.user.login}
                                                className="h-5 w-5 rounded-full"
                                            />
                                        )}
                                        <span className="font-medium">
                                            {r.user?.login}
                                        </span>
                                        <span className="ml-auto">
                                            {reactionEmojis[r.content]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            })}
        </div>
    );
}
