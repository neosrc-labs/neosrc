"use client";

import { type ReactNode, useState } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";

/** Format a millisecond duration as `Xm Ys` (or `Ys` under a minute). */
export function formatDurationMs(diffMs: number): string {
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    if (min > 0) {
        return `${min}m ${sec}s`;
    }
    return `${sec}s`;
}

/**
 * Open/hover state for a hover card that only fetches its content after the
 * trigger has been hovered. Combine `open` with the loaded data to decide
 * whether the card is shown.
 */
export function useLazyHoverCardState() {
    const [open, setOpen] = useState(false);
    const [hasBeenHovered, setHasBeenHovered] = useState(false);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            setHasBeenHovered(true);
        }
    };

    return { open, hasBeenHovered, handleOpenChange };
}

/** HoverCard wired to a lazy open state; renders `content` when `open`. */
export function LazyHoverCard({
    open,
    onOpenChange,
    children,
    content,
}: {
    open: boolean;
    onOpenChange: (isOpen: boolean) => void;
    children: ReactNode;
    content: ReactNode;
}) {
    return (
        <HoverCard open={open} onOpenChange={onOpenChange}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-80 bg-surface p-0">
                {content}
            </HoverCardContent>
        </HoverCard>
    );
}
