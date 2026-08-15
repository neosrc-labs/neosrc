"use client";

import { useEffect } from "react";
import type { DiffRenderItem } from "./types";

const SCROLL_TARGET_PADDING = 12;

export function useDiffHashNavigation({
    fileHash,
    renderItemsRef,
    setExpandedGapKeys,
    setSelectedRange,
}: {
    fileHash: string;
    renderItemsRef: React.RefObject<DiffRenderItem[]>;
    setExpandedGapKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
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
                for (const item of renderItemsRef.current) {
                    if (item.type !== "gap") continue;
                    const gapEnd =
                        item.endLine === -1 ? Infinity : item.endLine;
                    if (startLine < item.startLine || startLine > gapEnd)
                        continue;
                    const gapKey = `gap-${item.startLine}`;
                    setExpandedGapKeys((previous) => {
                        if (previous.has(gapKey)) return previous;
                        const next = new Set(previous);
                        next.add(gapKey);
                        return next;
                    });
                    break;
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
    }, [fileHash, renderItemsRef, setExpandedGapKeys, setSelectedRange]);
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
