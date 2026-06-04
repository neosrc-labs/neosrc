"use client";

import { useEffect, useRef, useState } from "react";

interface LazyRenderItemProps {
    itemKey: string;
    heightMap: Map<string, number>;
    rootMargin?: string;
    id?: string;
    className?: string;
    children: React.ReactNode;
}

export function LazyRenderItem({
    itemKey,
    heightMap,
    rootMargin = "1500px",
    id,
    className,
    children,
}: LazyRenderItemProps) {
    const [isVisible, setIsVisible] = useState(true);
    const ref = useRef<HTMLDivElement>(null);
    const height = heightMap.get(itemKey);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry) setIsVisible(entry.isIntersecting);
            },
            { rootMargin },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [rootMargin]);

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

    if (!isVisible && height !== undefined) {
        return (
            <div className={className} id={id} ref={ref} style={{ height }} />
        );
    }

    return (
        <div className={className} id={id} ref={ref}>
            {children}
        </div>
    );
}
