"use client";

import type { Key, ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * Intersection-observer sentinel that fetches the next page when the end of a
 * virtualized list scrolls into view. Returns the ref to attach to the
 * sentinel element.
 */
export function useInfiniteScrollSentinel({
    hasNextPage,
    fetchNextPage,
    scrollRef,
}: {
    hasNextPage: boolean;
    fetchNextPage: () => void;
    scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        const scrollEl = scrollRef.current;
        if (!el || !scrollEl || !hasNextPage) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { root: scrollEl, rootMargin: "400px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasNextPage, fetchNextPage, scrollRef]);

    return sentinelRef;
}

/** Absolutely-positioned frame for one row of a virtualized list. */
export function VirtualItemFrame({
    virtualItem,
    children,
}: {
    virtualItem: { key: Key; size: number; start: number };
    children: ReactNode;
}) {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
            }}
        >
            {children}
        </div>
    );
}
