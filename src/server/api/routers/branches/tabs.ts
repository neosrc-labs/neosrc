import type { BranchRow, BranchTab } from "./types";

/** github.com counts a branch as active when it was committed to recently. */
export const ACTIVE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** Rows previewed by the overview tab's "Active branches" section. */
export const OVERVIEW_PREVIEW_SIZE = 5;

/**
 * Branches carry a commit date from both providers, but a ref GitHub resolved
 * without a commit (or a Forgejo branch missing `timestamp`) has none. Such a
 * row counts as ancient rather than dropping out of every tab.
 */
function updatedAtMs(updatedAt: string): number {
    const parsed = Date.parse(updatedAt);
    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The tab's branch selection: the default branch is its own section on the
 * overview tab and is excluded everywhere except `all`, `query` is a
 * case-insensitive substring match, and the order is the tab's.
 */
export function selectTabRows(
    rows: BranchRow[],
    opts: {
        tab: BranchTab;
        query: string;
        defaultBranch: string | null;
        now: number;
    },
): BranchRow[] {
    const cutoff = opts.now - ACTIVE_WINDOW_MS;
    const needle = opts.query.trim().toLowerCase();
    const kept = rows.filter((row) => {
        if (opts.tab !== "all" && row.name === opts.defaultBranch) return false;
        return needle === "" || row.name.toLowerCase().includes(needle);
    });

    switch (opts.tab) {
        case "active":
            return kept
                .filter((row) => updatedAtMs(row.updatedAt) >= cutoff)
                .sort(
                    (a, b) =>
                        updatedAtMs(b.updatedAt) - updatedAtMs(a.updatedAt),
                );
        case "stale":
            return kept
                .filter((row) => updatedAtMs(row.updatedAt) < cutoff)
                .sort(
                    (a, b) =>
                        updatedAtMs(a.updatedAt) - updatedAtMs(b.updatedAt),
                );
        case "overview":
            return kept
                .filter((row) => updatedAtMs(row.updatedAt) >= cutoff)
                .sort(
                    (a, b) =>
                        updatedAtMs(b.updatedAt) - updatedAtMs(a.updatedAt),
                )
                .slice(0, OVERVIEW_PREVIEW_SIZE);
        default:
            return kept.sort(
                (a, b) => updatedAtMs(b.updatedAt) - updatedAtMs(a.updatedAt),
            );
    }
}

export function paginateRows<T>(
    rows: T[],
    page: number,
    pageSize: number,
): { items: T[]; totalCount: number; hasNextPage: boolean } {
    const start = (page - 1) * pageSize;
    return {
        items: rows.slice(start, start + pageSize),
        totalCount: rows.length,
        hasNextPage: page * pageSize < rows.length,
    };
}
