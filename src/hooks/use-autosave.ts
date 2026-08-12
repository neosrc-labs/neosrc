"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Read a previously autosaved value from localStorage.
 * Safe to call during SSR (returns null).
 */
export function readAutosave(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Debounced autosave of a value to localStorage.
 *
 * - On every change of `value`, schedules a debounced write to localStorage.
 * - When `value` is empty, removes the entry.
 * - Returns `clear()` to immediately delete the entry (call on successful save).
 * - Pass `null` for `key` to disable autosave for that editor instance.
 */
export function useAutosave(
    key: string | null,
    value: string,
    opts?: { debounceMs?: number },
): { clear: () => void } {
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    useEffect(() => {
        if (key === null) return;

        timerRef.current = setTimeout(() => {
            try {
                if (value) {
                    window.localStorage.setItem(key, value);
                } else {
                    window.localStorage.removeItem(key);
                }
            } catch {
                // Ignore quota errors and private browsing restrictions.
            }
        }, opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS);
    }, [key, value, opts?.debounceMs]);

    const clear = useCallback(() => {
        if (key === null) return;
        try {
            window.localStorage.removeItem(key);
        } catch {
            // Ignore.
        }
    }, [key]);

    return { clear };
}
