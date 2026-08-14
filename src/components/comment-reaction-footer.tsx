"use client";

import { ReactionBar } from "~/components/reaction-bar";
import { ReactionPicker } from "~/components/reaction-picker";
import type { ReactionContent } from "~/lib/reactions";

interface CommentReactionFooterProps {
    reactions: { content: string }[];
    currentUserLogin: string | null;
    onReact: (content: ReactionContent) => void;
    disabled?: boolean;
    className?: string;
}

export function CommentReactionFooter({
    reactions,
    currentUserLogin,
    onReact,
    disabled = false,
    className = "flex flex-wrap items-center gap-1.5 px-4 pb-3",
}: CommentReactionFooterProps) {
    return (
        <div className={className}>
            <ReactionPicker
                disabled={disabled}
                reactions={reactions}
                currentUserLogin={currentUserLogin}
                onReact={onReact}
            />
            <ReactionBar
                disabled={disabled}
                reactions={reactions}
                currentUserLogin={currentUserLogin}
                onReact={onReact}
            />
        </div>
    );
}
