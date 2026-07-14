"use client";

import { useMemo } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
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
                    <Tooltip key={content}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-pressed={isActive}
                                aria-label={`${REACTION_EMOJIS[content] ?? content} (${counts?.[content] ?? rs.length})`}
                                onClick={() => !disabled && onReact(content)}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs transition-colors ${
                                    isActive
                                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                        : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
                                }`}
                            >
                                <span>
                                    {REACTION_EMOJIS[content] ?? content}
                                </span>
                                <span>{counts?.[content] ?? rs.length}</span>
                                {rs
                                    .filter(
                                        (r) =>
                                            r.user?.login !==
                                                currentUserLogin &&
                                            (r.user?.avatar_url ||
                                                r.user?.avatarUrl),
                                    )
                                    .slice(0, 4)
                                    .map((r, i, arr) => (
                                        <img
                                            key={r.id ?? r.databaseId}
                                            src={
                                                r.user?.avatar_url ??
                                                r.user?.avatarUrl
                                            }
                                            alt={r.user?.login ?? ""}
                                            className={`h-4 w-4 rounded-full ring-1 ring-white dark:ring-zinc-800 ${
                                                i === 0 ? "ml-0.5" : "-ml-1.5"
                                            }`}
                                            style={{
                                                zIndex: arr.length - i,
                                            }}
                                        />
                                    ))}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            className="max-w-64 text-center"
                        >
                            {rs
                                .map((r) => r.user?.login)
                                .filter(Boolean)
                                .join(", ")}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}
