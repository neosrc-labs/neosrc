"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
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
    const [fixedWidth, setFixedWidth] = useState(0);
    const [fixedLeft, setFixedLeft] = useState(0);

    const captureDimensions = useCallback(() => {
        const bar = barRef.current;
        if (!bar) return;
        const row = bar.parentElement?.parentElement;
        if (!row) return;
        const rect = row.getBoundingClientRect();
        setFixedWidth(rect.width);
        setFixedLeft(rect.left);
    }, []);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const headerEl = document.documentElement;
        const headerHeight = parseFloat(
            getComputedStyle(headerEl).getPropertyValue("--header-height") ||
                "0",
        );

        const observer = new IntersectionObserver(
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

        return () => observer.disconnect();
    }, [captureDimensions]);

    useEffect(() => {
        if (!isSticky) return;

        const handleResize = () => captureDimensions();
        window.addEventListener("resize", handleResize, { passive: true });

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [isSticky, captureDimensions]);

    return (
        <>
            <div ref={sentinelRef} className="h-px" />
            <div
                ref={barRef}
                style={
                    isSticky
                        ? {
                              position: "fixed",
                              top: 0,
                              left: `${fixedLeft}px`,
                              width: `${fixedWidth}px`,
                              zIndex: 20,
                              backgroundColor: "var(--color-surface, #ffffff)",
                              paddingTop: "8px",
                              paddingBottom: "8px",
                              borderBottom:
                                  "1px solid var(--color-border-subtle, #e5e7eb)",
                          }
                        : undefined
                }
            >
                <Async
                    fallback={null}
                    promise={
                        checkRunsPromise ?? Promise.resolve<CheckRun[]>([])
                    }
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
            {isSticky && <div aria-hidden style={{ height: "48px" }} />}
        </>
    );
}
