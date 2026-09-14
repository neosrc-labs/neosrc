"use client";

import { cn } from "~/lib/utils";

/** 2px progress strip reserved at the top of a card; pulsing while data loads. */
export function RepoBusyBar({ busy }: { busy: boolean }) {
    return (
        <div
            aria-hidden
            className={cn(
                "h-0.5 w-full bg-blue-500/70",
                busy ? "animate-pulse opacity-100" : "opacity-0",
            )}
        />
    );
}
