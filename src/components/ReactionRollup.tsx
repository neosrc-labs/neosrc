"use client";

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
import type { GQLReactionNode } from "~/server/github-graphql";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import { api } from "~/trpc/react";

export type Reaction = GQLReactionNode;

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

type ReactionContent =
    | "+1"
    | "-1"
    | "laugh"
    | "confused"
    | "heart"
    | "hooray"
    | "rocket"
    | "eyes";

const reactionOrder: ReactionContent[] = [
    "+1",
    "heart",
    "laugh",
    "hooray",
    "confused",
    "rocket",
    "eyes",
    "-1",
];

interface ReactionRollupProps {
    reactions?: Reaction[];
    currentUserLogin?: string;
    commentId?: number;
    owner: string;
    repo: string;
    number: number;
    isIssue?: boolean;
}

function ContentType({ reaction }: { reaction: Reaction }) {
    const emoji = reactionEmojis[reaction.content] ?? reaction.content;

    return <span className="text-base leading-none">{emoji}</span>;
}

export function ReactionRollup({
    reactions = [],
    currentUserLogin,
    commentId,
    owner,
    repo,
    number,
    isIssue,
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
            utils.reactions.get.setData(
                { owner, repo, number },
                (old: any) => {
                    if (!old) return old;
                    const existing = old.reactions?.find(
                        (r: any) =>
                            r.user?.login === resolvedUserLogin &&
                            r.content === content,
                    );
                    const updated = existing
                        ? old.reactions.filter(
                              (r: any) => r.id !== existing.id,
                          )
                        : [
                              ...old.reactions,
                              {
                                  id: -Date.now(),
                                  node_id: "",
                                  user: {
                                      login: resolvedUserLogin ?? "",
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
                              },
                          ];
                    return { ...old, reactions: updated };
                },
            );
            return { prevData };
        },
        onError: (_err: any, _vars: any, ctx: any) => {
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
                    const existing = reactions.find(
                        (r) =>
                            r.user?.login === resolvedUserLogin &&
                            r.content === content,
                    );
                    const updatedReactions = existing
                        ? reactions.filter(
                              (r) => r.databaseId !== existing.databaseId,
                          )
                        : [
                              ...reactions,
                              {
                                  databaseId: -Date.now(),
                                  content,
                                  createdAt: new Date().toISOString(),
                                  user: { login: resolvedUserLogin ?? "" },
                              },
                          ];
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

    const available = reactionOrder.filter(
        (content) => !reactions.some((r) => r.content === content),
    );

    if (reactions.length === 0 && !currentUserLogin) return null;

    const hasReacted = resolvedUserLogin
        ? reactions.some(
              (r) => r.user?.login === resolvedUserLogin,
          )
        : false;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {reactionOrder.map((content) => {
                const group = grouped.get(content);
                if (!group) return null;
                const hasReactedToThis = resolvedUserLogin
                    ? group.some(
                          (r) => r.user?.login === resolvedUserLogin,
                      )
                    : false;

                return (
                    <HoverCard key={content} openDelay={200}>
                        <HoverCardTrigger asChild>
                            <button
                                type="button"
                                onClick={() => {
                                    const mutation = isIssue
                                        ? issueMutation
                                        : commentMutation;
                                    mutation.mutate({
                                        owner,
                                        repo,
                                        number,
                                        commentId: commentId ?? number,
                                        content: content as ReactionContent,
                                    });
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
                            <div className="text-xs text-gray-600 dark:text-zinc-400">
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
                                        const mutation = isIssue
                                            ? issueMutation
                                            : commentMutation;
                                        mutation.mutate({
                                            owner,
                                            repo,
                                            number,
                                            commentId: commentId ?? number,
                                            content:
                                                content as ReactionContent,
                                        });
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
            )}
        </div>
    );
}
