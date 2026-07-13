"use client";

import { useEffect, useRef, useState } from "react";

export const SCROLL_TARGET_EVENT = "scroll-target";

interface LazyRenderItemProps {
    itemKey: string;
    heightMap: Map<string, number>;
    rootMargin?: string;
    id?: string;
    className?: string;
    extraHeight?: number;
    renderOnIds?: string[];
    children: React.ReactNode;
}

export function LazyRenderItem({
    itemKey,
    heightMap,
    rootMargin = "1500px",
    id,
    className,
    extraHeight = 0,
    renderOnIds,
    children,
}: LazyRenderItemProps) {
    const [isVisible, setIsVisible] = useState(true);
    const ref = useRef<HTMLDivElement>(null);
    const height = heightMap.get(itemKey);
    const wasEverIntersecting = useRef(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: isVisible is needed to re-run after DOM visibility toggle
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                if (entry.isIntersecting) {
                    wasEverIntersecting.current = true;
                    setIsVisible(true);
                } else if (wasEverIntersecting.current) {
                    setIsVisible(false);
                }
            },
            { rootMargin },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [rootMargin, isVisible]);

    useEffect(() => {
        if (!renderOnIds || renderOnIds.length === 0) return;

        const handler = (e: Event) => {
            const targetId = (e as CustomEvent<string>).detail;
            if (renderOnIds.includes(targetId)) {
                setIsVisible(true);
            }
        };
        window.addEventListener(SCROLL_TARGET_EVENT, handler);
        return () => window.removeEventListener(SCROLL_TARGET_EVENT, handler);
    }, [renderOnIds]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !isVisible) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const h = entry.contentRect.height;
            if (h > 0) {
                heightMap.set(itemKey, h);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [isVisible, itemKey, heightMap]);

    useEffect(() => {
        return () => {
            heightMap.delete(itemKey);
        };
    }, [itemKey, heightMap]);

    if (!isVisible) {
        return (
            <div
                className={className}
                id={id}
                ref={ref}
                style={{
                    height:
                        height !== undefined
                            ? height + extraHeight
                            : Math.max(extraHeight, 64),
                }}
            />
        );
    }

    return (
        <div className={className} id={id} ref={ref}>
            {children}
        </div>
    );
}
