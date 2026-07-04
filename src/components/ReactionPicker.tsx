"use client";

import { SmilePlus } from "lucide-react";
import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { ReactionContent } from "~/lib/reactions";
import { ALL_REACTIONS, REACTION_EMOJIS } from "~/lib/reactions";

interface ReactionItem {
    content: string;
    user?: { login?: string } | null;
}

interface ReactionPickerProps {
    reactions: ReactionItem[];
    currentUserLogin?: string | null;
    onReact: (content: ReactionContent) => void;
    disabled?: boolean;
}

export function ReactionPicker({
    reactions,
    currentUserLogin,
    onReact,
    disabled,
}: ReactionPickerProps) {
    const [open, setOpen] = useState(false);

    if (!currentUserLogin || disabled) return null;

    const availableReactions = ALL_REACTIONS.filter(
        (c) =>
            !reactions.some(
                (r) => r.user?.login === currentUserLogin && r.content === c,
            ),
    );

    if (availableReactions.length === 0) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Add reaction"
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
                            aria-label={content}
                            onClick={() => {
                                onReact(content);
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
    );
}
