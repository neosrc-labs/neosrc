import { useEffect, useState } from "react";
import type { PullRequestFile } from "~/server/github";

interface UseFilesParams {
    owner: string;
    repo: string;
    number: number;
    commitSha?: string;
}
type CacheEntry = {
    files: PullRequestFile[];
    subscribers: Set<(files: PullRequestFile[]) => void>;
    loadingSubscribers: Set<(loading: boolean) => void>;
    controller: AbortController;
    isLoading: boolean;
};

const cache = new Map<string, CacheEntry>();

function getCacheKey(
    owner: string,
    repo: string,
    number: number,
    commitSha?: string,
) {
    return `${owner}/${repo}/${number}/${commitSha ?? ""}`;
}

function fetchFiles(
    key: string,
    owner: string,
    repo: string,
    number: number,
    commitSha?: string,
) {
    const controller = new AbortController();
    const entry: CacheEntry = {
        files: [],
        subscribers: new Set(),
        loadingSubscribers: new Set(),
        controller,
        isLoading: true,
    };
    cache.set(key, entry);

    (async () => {
        try {
            const res = await fetch(
                `/api/files?owner=${owner}&repo=${repo}&number=${number}` +
                    (commitSha ? `&commitSha=${commitSha}` : ""),
                { signal: controller.signal },
            );
            const reader = res.body?.getReader();
            if (!reader)
                throw new Error("body reader was null when loading files");

            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines.filter(Boolean)) {
                    const data = JSON.parse(line);
                    entry.files = [...entry.files, ...data];
                    for (const cb of entry.subscribers) cb(entry.files);
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError")
                return;
            throw err;
        } finally {
            if (!controller.signal.aborted) {
                entry.isLoading = false;
                for (const cb of entry.loadingSubscribers) cb(false);
            }
        }
    })();

    return entry;
}

// NOTE: Even if `isLoading` is `true` we may have a partially complete list of files already.
//       Depending on the UI element, we can either wait for the full list or display a partial list.
export function useFiles({ owner, repo, number, commitSha }: UseFilesParams) {
    const [files, setFiles] = useState<PullRequestFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const key = getCacheKey(owner, repo, number, commitSha);

        // Reuse an in-flight or completed entry, otherwise start a new fetch
        const entry =
            cache.get(key) ?? fetchFiles(key, owner, repo, number, commitSha);

        // Sync immediately with whatever is already buffered
        setFiles(entry.files);
        setIsLoading(entry.isLoading);

        // Subscribe to future updates
        entry.subscribers.add(setFiles);
        entry.loadingSubscribers.add(setIsLoading);

        return () => {
            entry.subscribers.delete(setFiles);
            entry.loadingSubscribers.delete(setIsLoading);

            // Only abort when the last consumer unmounts
            if (entry.subscribers.size === 0) {
                entry.controller.abort();
                cache.delete(key);
            }
        };
    }, [owner, repo, number, commitSha]);

    return { files, isLoading };
}
