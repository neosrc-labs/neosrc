"use client";

import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item !== null) {
                setStoredValue(JSON.parse(item) as T);
            }
        } catch {
            // Ignore errors
        }
    }, [key]);

    const setValue = useCallback(
        (value: T) => {
            setStoredValue(value);
            try {
                window.localStorage.setItem(key, JSON.stringify(value));
            } catch {
                // Ignore errors
            }
        },
        [key],
    );

    return [storedValue, setValue];
}
