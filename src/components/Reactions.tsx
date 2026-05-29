"use client";

import { REACTION_EMOJIS } from "~/lib/reactions";
import { api } from "~/trpc/react";

interface ReactionsProps {
    owner: string;
    repo: string;
    number: number;
}

export function Reactions({ owner, repo, number }: ReactionsProps) {
    const { data, isLoading } = api.reactions.get.useQuery(
        { owner, repo, number },
        { staleTime: 5 * 60 * 1000 },
    );

    if (isLoading) {
        return (
            <div className="flex gap-2 py-2">
                <div className="h-6 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                <div className="h-6 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
            </div>
        );
    }

    if (!data?.reactions || data.reactions.length === 0) return null;

    const counts: Record<string, number> = {};
    for (const reaction of data.reactions) {
        counts[reaction.content] = (counts[reaction.content] ?? 0) + 1;
    }

    const entries = Object.entries(counts).filter(([, count]) => count > 0);

    if (entries.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 py-2">
            {entries.map(([content, count]) => (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-700 text-sm dark:bg-zinc-800 dark:text-gray-300"
                    key={content}
                >
                    <span>{REACTION_EMOJIS[content] ?? content}</span>
                    <span>{count}</span>
                </span>
            ))}
        </div>
    );
}
