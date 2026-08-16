"use client";

import { useEffect } from "react";
import type { DiffRenderItem, GapExpansion } from "./types";

const SCROLL_TARGET_PADDING = 12;

export function useDiffHashNavigation({
    fileHash,
    renderItemsRef,
    setExpandedGaps,
    setSelectedRange,
}: {
    fileHash: string;
    renderItemsRef: React.RefObject<DiffRenderItem[]>;
    setExpandedGaps: React.Dispatch<
        React.SetStateAction<Map<string, GapExpansion>>
    >;
    setSelectedRange: React.Dispatch<
        React.SetStateAction<{
            startLine: number;
            endLine: number;
            side: string;
        } | null>
    >;
}) {
    useEffect(() => {
        let rafId = 0;
        let verifyTimeout: ReturnType<typeof setTimeout> | undefined;
        let settleTimeout: ReturnType<typeof setTimeout> | undefined;

        const stopPolling = () => {
            cancelAnimationFrame(rafId);
            clearTimeout(verifyTimeout);
            clearTimeout(settleTimeout);
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
                const targets = [startLine, endLine];
                for (const item of renderItemsRef.current) {
                    if (item.type !== "gap") continue;
                    const gapEnd =
                        item.endLine === -1 ? Infinity : item.endLine;
                    const inGap = targets.filter(
                        (target) =>
                            target >= item.startLine && target <= gapEnd,
                    );
                    if (inGap.length === 0) continue;
                    const gapKey = `gap-${item.startLine}`;
                    // Reveal just enough of the gap to include both target
                    // lines; the rest stays behind an unfold row. Leading
                    // gaps (above the first hunk) reveal backward from the
                    // hunk, so the count is measured from the gap end there.
                    const neededTop =
                        item.startLine === 1
                            ? 0
                            : Math.max(...inGap) - item.startLine + 1;
                    const neededBottom =
                        item.startLine === 1
                            ? gapEnd - Math.min(...inGap) + 1
                            : 0;
                    setExpandedGaps((previous) => {
                        const current = previous.get(gapKey) ?? {
                            top: 0,
                            bottom: 0,
                        };
                        const next = {
                            top: Math.max(current.top, neededTop),
                            bottom: Math.max(current.bottom, neededBottom),
                        };
                        if (
                            next.top === current.top &&
                            next.bottom === current.bottom
                        )
                            return previous;
                        const map = new Map(previous);
                        map.set(gapKey, next);
                        return map;
                    });
                }
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
                setSelectedRange({ startLine, endLine, side });
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
            settleTimeout = setTimeout(() => {
                cancelAnimationFrame(rafId);
                clearTimeout(verifyTimeout);
            }, 15_000);
            rafId = requestAnimationFrame(poll);
        };

        scrollToHashTarget();
        window.addEventListener("hashchange", scrollToHashTarget);
        return () => {
            window.removeEventListener("hashchange", scrollToHashTarget);
            stopPolling();
        };
    }, [fileHash, renderItemsRef, setExpandedGaps, setSelectedRange]);
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
