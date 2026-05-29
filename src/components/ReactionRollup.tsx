"use client";

import type { components } from "@octokit/openapi-types";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
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
import {
    REACTION_EMOJIS,
    REACTION_ORDER,
    type ReactionContent,
    toggleReactionInList,
} from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { GQLReactionNode } from "~/server/github-graphql";
import { api } from "~/trpc/react";

export type Reaction = GQLReactionNode;
type SimpleUser = components["schemas"]["nullable-simple-user"];

interface ReactionRollupProps {
    reactions?: Reaction[];
    currentUserLogin?: string;
    commentId?: number;
    subjectId?: string;
    owner: string;
    repo: string;
    number: number;
    isIssue?: boolean;
    isReview?: boolean;
}

function ContentType({ reaction }: { reaction: Reaction }) {
    const emoji = REACTION_EMOJIS[reaction.content] ?? reaction.content;

    return <span className="text-base leading-none">{emoji}</span>;
}

export function ReactionRollup({
    reactions = [],
    currentUserLogin,
    commentId,
    subjectId,
    owner,
    repo,
    number,
    isIssue,
    isReview,
}: ReactionRollupProps) {
    const [open, setOpen] = useState(false);
    const utils = api.useUtils();

    const resolvedUserLogin = currentUserLogin;

    const issueMutation = api.reactions.toggleIssue.useMutation({
        onMutate: async ({ content }) => {
            await utils.reactions.get.cancel({ owner, repo, number });
            const prevData = utils.reactions.get.getData({
                owner,
                repo,
                number,
            });
            utils.reactions.get.setData({ owner, repo, number }, (old) => {
                if (!old) return old;
                const existing = old.reactions?.find(
                    (r) =>
                        r.user?.login === resolvedUserLogin &&
                        r.content === content,
                );
                const updated = existing
                    ? old.reactions.filter((r) => r.id !== existing.id)
                    : [
                          ...old.reactions,
                          createOptimisticUpdateReaction(
                              resolvedUserLogin ?? "",
                              content,
                          ),
                      ];
                return { ...old, reactions: updated };
            });
            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.reactions.get.setData(
                    { owner, repo, number },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.reactions.get.invalidate({ owner, repo, number });
        },
    });

    const reviewMutation = api.reactions.togglePullRequestReview.useMutation({
        onMutate: async ({ content }) => {
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
            utils.timeline.list.setInfiniteData(
                { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                (old) => {
                    if (!old) return old;
                    const updatedReactions = toggleReactionInList(
                        reactions,
                        resolvedUserLogin ?? "",
                        content,
                    );
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            commentReactions: {
                                ...page.commentReactions,
                                [commentId!]: updatedReactions,
                            },
                        })),
                    };
                },
            );
            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
        },
    });

    const commentMutation = api.reactions.toggleIssueComment.useMutation({
        onMutate: async ({ content }) => {
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
            utils.timeline.list.setInfiniteData(
                { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                (old) => {
                    if (!old) return old;
                    const updatedReactions = toggleReactionInList(
                        reactions,
                        resolvedUserLogin ?? "",
                        content,
                    );
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            commentReactions: {
                                ...page.commentReactions,
                                [commentId!]: updatedReactions,
                            },
                        })),
                    };
                },
            );
            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
        },
    });

    const grouped = new Map<string, Reaction[]>();

    for (const reaction of reactions) {
        const current = grouped.get(reaction.content) ?? [];
        current.push(reaction);
        grouped.set(reaction.content, current);
    }

    const available = REACTION_ORDER.filter(
        (content) => !reactions.some((r) => r.content === content),
    );

    if (reactions.length === 0 && !currentUserLogin) return null;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {REACTION_ORDER.map((content) => {
                const group = grouped.get(content);
                if (!group) return null;
                const hasReactedToThis = resolvedUserLogin
                    ? group.some((r) => r.user?.login === resolvedUserLogin)
                    : false;

                return (
                    <HoverCard key={content} openDelay={200}>
                        <HoverCardTrigger asChild>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isReview) {
                                        reviewMutation.mutate({
                                            subjectId: subjectId ?? "",
                                            content: content as ReactionContent,
                                        });
                                    } else if (isIssue) {
                                        issueMutation.mutate({
                                            owner,
                                            repo,
                                            number,
                                            content: content as ReactionContent,
                                        });
                                    } else {
                                        commentMutation.mutate({
                                            owner,
                                            repo,
                                            commentId: commentId ?? number,
                                            content: content as ReactionContent,
                                        });
                                    }
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                    hasReactedToThis
                                        ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                                        : "border-gray-300 bg-transparent text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                                }`}
                            >
                                <ContentType reaction={group[0]!} />
                                <span>{group.length}</span>
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-fit bg-white p-2 dark:bg-zinc-950">
                            <div className="text-gray-600 text-xs dark:text-zinc-400">
                                {group
                                    .slice(0, 10)
                                    .map((r) => r.user?.login)
                                    .filter(Boolean)
                                    .join(", ")}
                                {group.length > 10 &&
                                    ` and ${group.length - 10} more`}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            })}

            {currentUserLogin && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 border-dashed px-2 py-0.5 text-gray-400 text-xs transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                        >
                            <SmilePlus size={14} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-fit bg-white p-2 dark:bg-zinc-950">
                        <div className="flex gap-1">
                            {available.map((content) => (
                                <button
                                    key={content}
                                    type="button"
                                    onClick={() => {
                                        if (isReview) {
                                            reviewMutation.mutate({
                                                subjectId: subjectId ?? "",
                                                content:
                                                    content as ReactionContent,
                                            });
                                        } else if (isIssue) {
                                            issueMutation.mutate({
                                                owner,
                                                repo,
                                                number,
                                                content:
                                                    content as ReactionContent,
                                            });
                                        } else {
                                            commentMutation.mutate({
                                                owner,
                                                repo,
                                                commentId: commentId ?? number,
                                                content:
                                                    content as ReactionContent,
                                            });
                                        }
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer rounded p-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                                >
                                    {REACTION_EMOJIS[content] ?? content}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

function createOptimisticUpdateReaction(
    userLogin: string,
    content: ReactionContent,
) {
    return {
        id: -Date.now(),
        node_id: "",
        user: {
            login: userLogin,
            name: "",
            email: "",
            id: 0,
            node_id: "",
            avatar_url: "",
            gravatar_id: "",
            url: "",
            html_url: "",
            followers_url: "",
            following_url: "",
            gists_url: "",
            starred_url: "",
            subscriptions_url: "",
            organizations_url: "",
            repos_url: "",
            events_url: "",
            received_events_url: "",
            type: "",
            site_admin: false,
        } satisfies SimpleUser,
        content,
        created_at: new Date().toISOString(),
    };
}
