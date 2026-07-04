"use client";

import { useMemo } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { ReactionContent } from "~/lib/reactions";
import { REACTION_EMOJIS, REACTION_ORDER } from "~/lib/reactions";

interface ReactionBarItem {
    content: string;
    id?: number | string;
    databaseId?: number | string;
    user?: {
        login?: string;
        avatar_url?: string;
        avatarUrl?: string;
    } | null;
}

interface ReactionBarProps {
    reactions: ReactionBarItem[];
    currentUserLogin?: string | null;
    onReact: (content: ReactionContent) => void;
    disabled?: boolean;
    counts?: Record<string, number>;
}

export function ReactionBar({
    reactions,
    currentUserLogin,
    onReact,
    disabled,
    counts,
}: ReactionBarProps) {
    const grouped = useMemo(() => {
        const map = new Map<string, ReactionBarItem[]>();
        for (const r of reactions) {
            const existing = map.get(r.content) ?? [];
            existing.push(r);
            map.set(r.content, existing);
        }
        return map;
    }, [reactions]);

    const entries = REACTION_ORDER.map(
        (content) => [content, grouped.get(content) ?? []] as const,
    ).filter(([content, rs]) =>
        counts ? (counts[content] ?? 0) > 0 : rs.length > 0,
    );

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {entries.map(([content, rs]) => {
                const isActive = currentUserLogin
                    ? rs.some((r) => r.user?.login === currentUserLogin)
                    : false;

                return (
                    <HoverCard key={content} openDelay={300}>
                        <HoverCardTrigger asChild>
                            <button
                                type="button"
                                aria-pressed={isActive}
                                aria-label={`${REACTION_EMOJIS[content] ?? content} (${counts?.[content] ?? rs.length})`}
                                onClick={() => !disabled && onReact(content)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs transition-colors ${
                                    isActive
                                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                        : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
                                }`}
                            >
                                <span>
                                    {REACTION_EMOJIS[content] ?? content}
                                </span>
                                <span>{counts?.[content] ?? rs.length}</span>
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-56 bg-white p-3 dark:bg-zinc-950">
                            <div className="flex flex-col gap-2">
                                {rs.map((r) => (
                                    <div
                                        key={r.id ?? r.databaseId}
                                        className="flex items-center gap-2 text-gray-700 text-sm dark:text-gray-300"
                                    >
                                        {(r.user?.avatar_url ||
                                            r.user?.avatarUrl) && (
                                            <img
                                                src={
                                                    r.user?.avatar_url ??
                                                    r.user?.avatarUrl
                                                }
                                                alt={r.user?.login ?? ""}
                                                className="h-5 w-5 rounded-full"
                                            />
                                        )}
                                        <span className="font-medium">
                                            {r.user?.login}
                                        </span>
                                        <span className="ml-auto">
                                            {REACTION_EMOJIS[r.content]}
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
