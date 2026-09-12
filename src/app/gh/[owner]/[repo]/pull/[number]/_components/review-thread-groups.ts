import type { ReviewThreadSummary } from "~/server/github";

export type ReviewThreadGroup = {
    label: string;
    /** Dot color for the section header, matching the checks sections. */
    color: string;
    threads: ReviewThreadSummary[];
};

const UNRESOLVED_COLOR = "#6b7280";
const RESOLVED_COLOR = "#16a34a";

/**
 * Threads split into unresolved and resolved, most actionable group first.
 * Mirrors the checks list ordering; empty groups are dropped.
 */
export function bucketReviewThreads(
    threads: ReviewThreadSummary[],
): ReviewThreadGroup[] {
    const unresolved: ReviewThreadSummary[] = [];
    const resolved: ReviewThreadSummary[] = [];
    for (const thread of threads) {
        if (thread.isResolved) {
            resolved.push(thread);
        } else {
            unresolved.push(thread);
        }
    }

    const groups: ReviewThreadGroup[] = [];
    if (unresolved.length > 0) {
        groups.push({
            label: "Unresolved",
            color: UNRESOLVED_COLOR,
            threads: unresolved,
        });
    }
    if (resolved.length > 0) {
        groups.push({
            label: "Resolved",
            color: RESOLVED_COLOR,
            threads: resolved,
        });
    }
    return groups;
}
