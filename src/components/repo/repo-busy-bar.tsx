"use client";

import { cn } from "~/utils/helpers";

/** 2px progress strip reserved at the top of a card; pulsing while data loads. */
export function RepoBusyBar({ busy }: { busy: boolean }) {
    return (
        <div
            aria-hidden
            className={cn(
                "h-0.5 w-full bg-action/70",
                busy ? "animate-pulse opacity-100" : "opacity-0",
            )}
        />
    );
}
