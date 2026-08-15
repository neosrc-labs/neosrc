"use client";

import { useEffect, useState } from "react";

export function useSvgContents(
    oldContentUrl: string | null,
    newContentUrl: string | null,
) {
    const [oldContent, setOldContent] = useState<string | null>(null);
    const [newContent, setNewContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [oldError, setOldError] = useState(false);
    const [newError, setNewError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setOldError(false);
            setNewError(false);
            const fetchContent = async (
                url: string | null,
                setContent: (value: string | null) => void,
                setError: (value: boolean) => void,
            ) => {
                if (!url) {
                    setContent(null);
                    return;
                }
                try {
                    const response = await fetch(url, {
                        signal: controller.signal,
                    });
                    if (!response.ok) setError(true);
                    else setContent(await response.text());
                } catch {
                    if (!controller.signal.aborted) setError(true);
                }
            };
            await fetchContent(oldContentUrl, setOldContent, setOldError);
            await fetchContent(newContentUrl, setNewContent, setNewError);
            if (!controller.signal.aborted) setLoading(false);
        };
        void load();
        return () => controller.abort();
    }, [oldContentUrl, newContentUrl]);
    return { oldContent, newContent, loading, oldError, newError };
}
