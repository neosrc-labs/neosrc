"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface StickyActionBarProps {
    children: ReactNode;
}

export function StickyActionBar({ children }: StickyActionBarProps) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [isStuck, setIsStuck] = useState(false);
    const [barHeight, setBarHeight] = useState(0);
    const [barStyle, setBarStyle] = useState<React.CSSProperties>({});
    const offsetRef = useRef(0);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                const stuck = !entry.isIntersecting;
                if (stuck && barRef.current) {
                    const barRect = barRef.current.getBoundingClientRect();
                    const main = document.querySelector("main");
                    const mainRect = main?.getBoundingClientRect();
                    if (mainRect) {
                        offsetRef.current = barRect.left - mainRect.left;
                    }
                    setBarStyle({
                        position: "fixed",
                        top: 0,
                        left: barRect.left,
                        width: barRect.width,
                        zIndex: 20,
                    });
                }
                setIsStuck(stuck);
            },
            { threshold: 0 },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isStuck) return;

        const updatePosition = () => {
            const main = document.querySelector("main");
            if (!main) return;
            setBarStyle((prev) => ({
                ...prev,
                left: main.getBoundingClientRect().left + offsetRef.current,
            }));
        };

        window.addEventListener("resize", updatePosition);
        return () => window.removeEventListener("resize", updatePosition);
    }, [isStuck]);

    useEffect(() => {
        const bar = barRef.current;
        if (!bar) return;

        const ro = new ResizeObserver(([entry]) => {
            if (entry) {
                setBarHeight(entry.contentRect.height);
            }
        });

        ro.observe(bar);
        return () => ro.disconnect();
    }, []);

    return (
        <>
            <div ref={sentinelRef} />
            {isStuck && (
                <div style={{ height: barHeight }} aria-hidden="true" />
            )}
            <div
                ref={barRef}
                className="bg-surface"
                style={isStuck ? barStyle : {}}
            >
                {children}
            </div>
        </>
    );
}
