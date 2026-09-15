export function formatDateTime(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatRelativeTime(
    isoDate: string,
    now: Date = new Date(),
): string {
    const diffMs = now.getTime() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    // Clamp future timestamps (e.g. client/server clock skew) to "now": a
    // negative diff must never render as "-N mins ago".
    if (diffMin <= 0) return "now";
    if (diffMin < 60)
        return diffMin === 1 ? `1 min ago` : `${diffMin} mins ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr === 1 ? `1 hour ago` : `${diffHr} hours ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "yesterday";
    if (diffDay < 7) return `${diffDay} days ago`;

    const diffWeek = Math.floor(diffDay / 7);
    if (diffDay < 31)
        return diffWeek === 1 ? `1 week ago` : `${diffWeek} weeks ago`;

    // Months cover up to 364 days so the years branch, which only runs at
    // 365+ days, can never compute a 0-year diff.
    const diffMonth = Math.floor(diffDay / 30);
    if (diffDay < 365)
        return diffMonth === 1 ? `1 month ago` : `${diffMonth} months ago`;

    const diffYear = Math.floor(diffDay / 365);
    return diffYear === 1 ? `1 year ago` : `${diffYear} years ago`;
}
