"use client";

import type { RefCallback } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface UseInViewOptions {
    rootMargin?: string;
    threshold?: number;
}

export function useInView({
    rootMargin = "400px",
    threshold = 0,
}: UseInViewOptions = {}): [RefCallback<HTMLElement>, boolean, boolean] {
    const [inView, setInView] = useState(false);
    const [ready, setReady] = useState(false);
    const elementRef = useRef<HTMLElement | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const ref = useCallback<RefCallback<HTMLElement>>((element) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        elementRef.current = element;

        if (element) {
            setInView(false);
            setReady(false);
        }
    }, []);

    useLayoutEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        if (typeof IntersectionObserver === "undefined") {
            setInView(true);
            setReady(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting) return;
                setInView(true);
                observer.disconnect();
                observerRef.current = null;
            },
            { rootMargin, threshold },
        );
        observerRef.current = observer;
        observer.observe(element);

        const rootMarginParts = rootMargin.trim().split(/\s+/);
        const parseMargin = (value: string | undefined) => {
            if (!value?.endsWith("px")) return 0;
            const margin = Number.parseFloat(value);
            return Number.isFinite(margin) ? margin : 0;
        };
        const topMargin = parseMargin(rootMarginParts[0]);
        const bottomMargin = parseMargin(
            rootMarginParts[rootMarginParts.length === 1 ? 0 : 2] ??
                rootMarginParts[0],
        );
        const rect = element.getBoundingClientRect();
        const initiallyInView =
            rect.bottom >= -topMargin &&
            rect.top <= window.innerHeight + bottomMargin;
        if (initiallyInView) {
            setInView(true);
            observer.disconnect();
            observerRef.current = null;
        }
        setReady(true);

        return () => {
            observer.disconnect();
            if (observerRef.current === observer) observerRef.current = null;
        };
    }, [rootMargin, threshold]);

    return [ref, inView, ready];
}
