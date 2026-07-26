"use client";

import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

interface StickyActionBarProps {
    children: ReactNode;
    measureRef?: React.RefObject<HTMLElement | null>;
    className?: string;
}

export function StickyActionBar({
    children,
    measureRef,
    className,
}: StickyActionBarProps) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [isFixed, setIsFixed] = useState(false);
    const [fixedStyle, setFixedStyle] = useState<CSSProperties>({});

    const updateDimensions = useCallback(() => {
        if (!isFixed) return;

        const targetEl = measureRef?.current;
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            setFixedStyle({
                position: "fixed",
                top: 0,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 20,
            });
        } else if (barRef.current?.parentElement) {
            const parentRect =
                barRef.current.parentElement.getBoundingClientRect();
            setFixedStyle({
                position: "fixed",
                top: 0,
                left: `${parentRect.left}px`,
                width: `${parentRect.width}px`,
                zIndex: 20,
            });
        }
    }, [isFixed, measureRef]);

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
                setIsFixed(!entry.isIntersecting);
            },
            {
                rootMargin: `-${headerHeight}px 0px 0px 0px`,
                threshold: 0,
            },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isFixed) {
            setFixedStyle({});
            return;
        }

        updateDimensions();

        const handleResize = () => updateDimensions();
        window.addEventListener("resize", handleResize, { passive: true });

        const observer = new ResizeObserver(() => updateDimensions());
        const targetEl = measureRef?.current;
        if (targetEl) {
            observer.observe(targetEl);
        } else if (barRef.current?.parentElement) {
            observer.observe(barRef.current.parentElement);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            observer.disconnect();
        };
    }, [isFixed, measureRef, updateDimensions]);

    return (
        <>
            <div ref={sentinelRef} className="h-px" />
            <div
                ref={barRef}
                className={className}
                style={
                    isFixed
                        ? {
                              ...fixedStyle,
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
