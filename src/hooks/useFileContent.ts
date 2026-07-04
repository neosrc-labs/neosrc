"use client";

import { useEffect, useState } from "react";

interface UseFileContentParams {
    owner: string;
    repo: string;
    sha: string;
    path: string;
}

interface CacheEntry {
    lines: string[] | null;
    error: Error | null;
    subscribers: Set<() => void>;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(sha: string, path: string) {
    return `${sha}:${path}`;
}

export function useFileContent({
    owner,
    repo,
    sha,
    path,
}: UseFileContentParams) {
    const [lines, setLines] = useState<string[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const key = getCacheKey(sha, path);
        let entry = cache.get(key);

        if (!entry) {
            entry = {
                lines: null,
                error: null,
                subscribers: new Set(),
            };
            cache.set(key, entry);

            const e = entry;
            const doFetch = async () => {
                try {
                    const res = await fetch(
                        `/api/raw/content?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(path)}`,
                    );
                    if (!res.ok)
                        throw new Error(
                            `Failed to fetch file content: ${res.status}`,
                        );
                    const text = await res.text();
                    e.lines = text.split("\n");
                } catch (err) {
                    e.error =
                        err instanceof Error ? err : new Error(String(err));
                } finally {
                    for (const cb of e.subscribers) cb();
                }
            };

            doFetch();
        }

        const update = () => {
            if (!entry) return;
            setLines(entry.lines);
            setError(entry.error);
            setIsLoading(entry.lines === null && entry.error === null);
        };

        setLines(entry.lines);
        setError(entry.error);
        setIsLoading(entry.lines === null && !entry.error);

        if (entry.lines === null && !entry.error) {
            entry.subscribers.add(update);
        }

        return () => {
            if (entry) {
                entry.subscribers.delete(update);
                if (entry.subscribers.size === 0) {
                    cache.delete(key);
                }
            }
        };
    }, [owner, repo, sha, path]);

    return { lines, isLoading, error };
}
