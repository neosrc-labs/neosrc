"use client";

import { useEffect } from "react";
import { diffGapKey, gapCommentRanges, mergeGapRanges } from "./model";
import type { DiffRenderItem, GapRange } from "./types";
import {
    collectRunBounds,
    type DiffSelectedRange,
} from "./use-diff-line-selection";

const SCROLL_TARGET_PADDING = 12;

// Keys that scroll the document: pressing one is the user taking over.
const SCROLL_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
]);

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
    );
}

export function useDiffHashNavigation({
    parsed,
    fileHash,
    renderItemsRef,
    setExpandedGaps,
    setSelectedRange,
}: {
    parsed: boolean;
    fileHash: string;
    renderItemsRef: React.RefObject<DiffRenderItem[]>;
    setExpandedGaps: React.Dispatch<
        React.SetStateAction<Map<string, GapRange[]>>
    >;
    setSelectedRange: React.Dispatch<
        React.SetStateAction<DiffSelectedRange | null>
    >;
}) {
    useEffect(() => {
        if (!parsed) return;
        let rafId = 0;
        let verifyTimeout: ReturnType<typeof setTimeout> | undefined;
        let settleTimeout: ReturnType<typeof setTimeout> | undefined;

        // Watching for user scroll input while the re-centering loop runs.
        let onScrollIntent: ((event: Event) => void) | null = null;

        const stopScrollIntentWatch = () => {
            if (!onScrollIntent) return;
            window.removeEventListener("wheel", onScrollIntent);
            window.removeEventListener("touchstart", onScrollIntent);
            window.removeEventListener("keydown", onScrollIntent);
            window.removeEventListener("mousedown", onScrollIntent);
            onScrollIntent = null;
        };

        const stopPolling = () => {
            cancelAnimationFrame(rafId);
            clearTimeout(verifyTimeout);
            clearTimeout(settleTimeout);
            stopScrollIntentWatch();
        };

        // The poll/verify loop keeps pulling the target line back under the
        // sticky bars while images, syntax highlighting and lazy diffs shift
        // the page. Once the user scrolls themselves it fights them instead,
        // so any scroll gesture ends this navigation's loop for good; the
        // next hashchange arms a fresh one.
        const watchScrollIntent = () => {
            stopScrollIntentWatch();
            onScrollIntent = (event: Event) => {
                if (event.type === "keydown") {
                    const key = (event as KeyboardEvent).key;
                    if (!SCROLL_KEYS.has(key) || isEditableTarget(event.target))
                        return;
                } else if (
                    event.type === "mousedown" &&
                    event.target !== document.documentElement
                ) {
                    // Scrollbar presses land on the root element; clicks
                    // inside the page are not scroll intent.
                    return;
                }
                stopPolling();
            };
            window.addEventListener("wheel", onScrollIntent, {
                passive: true,
            });
            window.addEventListener("touchstart", onScrollIntent, {
                passive: true,
            });
            window.addEventListener("keydown", onScrollIntent);
            window.addEventListener("mousedown", onScrollIntent);
        };

        const scrollToHashTarget = () => {
            stopPolling();
            const hash = window.location.hash;
            if (!hash.startsWith(`#diff-${fileHash}`)) return;
            const targetMatch = hash.match(/^#(diff-[0-9a-f]+[RL]\d+)/);
            const targetId = targetMatch?.[1];
            if (!targetId) return;
            const lineMatch = hash.match(/[RL](\d+)/g);
            const startLine = lineMatch
                ? Number.parseInt(lineMatch[0]?.slice(1) ?? "0", 10)
                : 0;
            const endLine = lineMatch?.[1]
                ? Number.parseInt(lineMatch[1].slice(1), 10)
                : startLine;
            const side = hash.includes("R") ? "RIGHT" : "LEFT";

            const expandTargetGap = () => {
                // A range may span several regions; reveal every gap that
                // contains either end of the selection so the whole range is
                // visible once collapsed rows are fetched.
                const additions = new Map<string, GapRange[]>();
                for (const item of renderItemsRef.current) {
                    if (item.type !== "gap") continue;
                    const ranges = gapCommentRanges(item, [
                        { side, line: startLine },
                        { side, line: endLine },
                    ]);
                    if (ranges.length > 0) {
                        additions.set(diffGapKey(item), ranges);
                    }
                }
                if (additions.size === 0) return;
                setExpandedGaps((previous) =>
                    mergeGapRanges(previous, additions),
                );
            };

            let cachedOffset = 0;
            const getTargetOffset = (element: HTMLElement) => {
                if (cachedOffset === 0) {
                    cachedOffset =
                        getStickyTopHeight(element) + SCROLL_TARGET_PADDING;
                }
                return cachedOffset;
            };
            const scrollToLine = (behavior: ScrollBehavior) => {
                const element = document.getElementById(targetId);
                if (!element) return false;
                const offset = getTargetOffset(element);
                window.scrollTo({
                    top: Math.max(
                        0,
                        element.getBoundingClientRect().top +
                            window.scrollY -
                            offset,
                    ),
                    behavior,
                });
                // Endpoint numbers live in one side's space and so do not
                // bracket unpaired rows inside the range; sweep the rows the
                // permalink actually covers (see collectRunBounds).
                const bounds = collectRunBounds(
                    element.closest("tr"),
                    side,
                    endLine,
                );
                setSelectedRange({
                    startLine,
                    endLine,
                    side,
                    ...(bounds ?? {}),
                });
                return true;
            };

            let lastAbsTop = -1;
            let stableFrames = 0;
            let scrolled = false;
            let scrollStart = 0;
            const verify = () => {
                const element = document.getElementById(targetId);
                if (!element) return;
                const offset = getTargetOffset(element);
                const rect = element.getBoundingClientRect();
                const diff = rect.top - offset;
                const atMaxScroll =
                    window.innerHeight + window.scrollY >=
                    document.body.scrollHeight - 2;
                if (diff < -4 || (diff > 24 && !atMaxScroll)) {
                    window.scrollTo({
                        top: rect.top + window.scrollY - offset,
                        behavior: "auto",
                    });
                    verifyTimeout = setTimeout(verify, 350);
                } else if (Date.now() - scrollStart < 3000) {
                    verifyTimeout = setTimeout(verify, 350);
                }
            };
            const poll = () => {
                const element = document.getElementById(targetId);
                if (element) {
                    const absoluteTop =
                        element.getBoundingClientRect().top + window.scrollY;
                    stableFrames =
                        absoluteTop === lastAbsTop ? stableFrames + 1 : 0;
                    lastAbsTop = absoluteTop;
                    if (stableFrames >= 3 && !scrolled) {
                        scrolled = true;
                        scrollStart = Date.now();
                        scrollToLine("smooth");
                        verifyTimeout = setTimeout(verify, 600);
                        return;
                    }
                } else {
                    expandTargetGap();
                }
                rafId = requestAnimationFrame(poll);
            };
            settleTimeout = setTimeout(stopPolling, 15_000);
            watchScrollIntent();
            rafId = requestAnimationFrame(poll);
        };

        scrollToHashTarget();
        window.addEventListener("hashchange", scrollToHashTarget);
        return () => {
            window.removeEventListener("hashchange", scrollToHashTarget);
            stopPolling();
        };
    }, [parsed, fileHash, renderItemsRef, setExpandedGaps, setSelectedRange]);
}

function getStickyTopHeight(target: HTMLElement): number {
    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let offset = 0;
    for (const element of document.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(element);
        if (style.position !== "sticky") continue;
        const stickyTop = Number.parseFloat(style.top);
        if (!Number.isFinite(stickyTop) || stickyTop < 0) continue;
        const rect = element.getBoundingClientRect();
        if (rect.height <= 0 || rect.bottom <= 0) continue;
        if (rect.left > targetCenterX || rect.right < targetCenterX) continue;
        offset = Math.max(offset, stickyTop + rect.height);
    }
    return offset;
}
