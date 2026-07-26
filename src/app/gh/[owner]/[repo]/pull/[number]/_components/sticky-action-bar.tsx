"use client";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

interface StickyActionBarProps {
    children: ReactNode;
    className?: string;
    onStickyChange?: (isFixed: boolean) => void;
}

export function StickyActionBar({
    children,
    className,
    onStickyChange,
}: StickyActionBarProps) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [isFixed, setIsFixed] = useState(false);
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
                setIsFixed(!entry.isIntersecting);
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
        onStickyChange?.(isFixed);
    }, [isFixed, onStickyChange]);

    useEffect(() => {
        if (!isFixed) return;

        const handleResize = () => captureDimensions();
        window.addEventListener("resize", handleResize, { passive: true });

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [isFixed, captureDimensions]);

    return (
        <>
            <div ref={sentinelRef} className="h-px" />
            <div
                ref={barRef}
                className={className}
                style={
                    isFixed
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
                {children}
            </div>
            {isFixed && <div aria-hidden style={{ height: "48px" }} />}
        </>
    );
}
