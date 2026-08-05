"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { EMPTY_ARRAY_PROMISE } from "~/utils/promise";
import { ActionSection } from "./actions-section";

interface HeaderActionBarProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
    checkRunsPromise?: Promise<CheckRun[]> | null;
}

// FIXME: Ideally we have 32 from the screen edge to account for the sidebar open/close icons.
//        But 32 is too large to look good when the sidebars are opened.
const MIN_EDGE_PADDING = 8;

export function HeaderActionBar({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
    checkRunsPromise,
}: HeaderActionBarProps) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [isSticky, setIsSticky] = useState(false);
    const [fixedLeft, setFixedLeft] = useState(0);
    const [fixedRight, setFixedRight] = useState(0);
    const [contentLeft, setContentLeft] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [mainWidth, setMainWidth] = useState(0);
    const [barHeight, setBarHeight] = useState(0);

    const captureDimensions = useCallback(() => {
        const main = sentinelRef.current?.closest("main");
        if (!main) return;

        const mainRect = main.getBoundingClientRect();
        setFixedLeft(mainRect.left);
        setMainWidth(mainRect.width);
        setFixedRight(document.documentElement.clientWidth - mainRect.right);

        const contentContainer = main.querySelector(".max-w-7xl") ?? main;
        const rect = contentContainer.getBoundingClientRect();
        setContentLeft(rect.left);
        setContentWidth(rect.width);
    }, []);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        let observer: IntersectionObserver | undefined;

        const createObserver = () => {
            observer?.disconnect();

            const headerHeight = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue(
                    "--header-height",
                ) || "0",
            );

            observer = new IntersectionObserver(
                ([entry]) => {
                    if (!entry) return;
                    if (!entry.isIntersecting) {
                        captureDimensions();
                    }
                    setIsSticky(!entry.isIntersecting);
                },
                {
                    rootMargin: `-${headerHeight}px 0px 0px 0px`,
                    threshold: 0,
                },
            );
            observer.observe(sentinel);
        };

        createObserver();
        window.addEventListener("resize", createObserver, { passive: true });

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", createObserver);
        };
    }, [captureDimensions]);

    useEffect(() => {
        const main = sentinelRef.current?.closest("main");
        if (!main) return;

        const resizeObserver = new ResizeObserver(() => {
            captureDimensions();
        });
        resizeObserver.observe(main);

        const contentContainer = main.querySelector(".max-w-7xl");
        if (contentContainer) {
            resizeObserver.observe(contentContainer);
        }

        return () => resizeObserver.disconnect();
    }, [captureDimensions]);

    useEffect(() => {
        const bar = barRef.current;
        if (!bar) return;

        const resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const height =
                entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
            setBarHeight(height);
        });
        resizeObserver.observe(bar);

        return () => resizeObserver.disconnect();
    }, []);

    const naturalMargin = contentLeft - fixedLeft;
    const hasNaturalGutter = naturalMargin >= MIN_EDGE_PADDING;
    const barMarginLeft = hasNaturalGutter ? naturalMargin : MIN_EDGE_PADDING;
    const barWidth = hasNaturalGutter
        ? contentWidth
        : mainWidth - MIN_EDGE_PADDING * 2;

    return (
        <>
            <div ref={sentinelRef} className="h-px" />
            <div
                style={
                    isSticky
                        ? {
                              position: "fixed",
                              top: 0,
                              left: `${fixedLeft}px`,
                              right: `${fixedRight}px`,
                              zIndex: 20,
                              backgroundColor: "var(--color-surface, #ffffff)",
                              borderBottom:
                                  "1px solid var(--color-border-subtle, #e5e7eb)",
                          }
                        : undefined
                }
            >
                <div
                    ref={barRef}
                    style={
                        isSticky
                            ? {
                                  marginLeft: `${barMarginLeft}px`,
                                  width: `${barWidth}px`,
                                  padding: "8px",
                              }
                            : undefined
                    }
                >
                    <Async
                        fallback={null}
                        promise={checkRunsPromise ?? EMPTY_ARRAY_PROMISE}
                    >
                        {(checkRuns) => (
                            <ActionSection
                                variant="header"
                                isSticky={isSticky}
                                owner={owner}
                                repo={repo}
                                number={number}
                                pullRequestPromise={pullRequestPromise}
                                conflictedFilesPromise={conflictedFilesPromise}
                                userPermissionPromise={userPermissionPromise}
                                currentUserLogin={currentUserLogin}
                                checkRuns={checkRuns}
                            />
                        )}
                    </Async>
                </div>
            </div>
            {isSticky && (
                <div aria-hidden style={{ height: `${barHeight}px` }} />
            )}
        </>
    );
}
