const VIEWED_PREFIX = "pr-file:viewed:";

export function getViewedKey(
    owner: string,
    repo: string,
    number: string | number,
): string {
    return `${VIEWED_PREFIX}${owner}:${repo}:${number}`;
}

export function getStoredSet(key: string): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const data = localStorage.getItem(key);
        return data ? new Set(JSON.parse(data) as string[]) : new Set();
    } catch {
        return new Set();
    }
}

export function setStoredSet(key: string, set: Set<string>): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
}
