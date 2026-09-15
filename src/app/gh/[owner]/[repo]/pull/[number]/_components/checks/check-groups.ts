import type { CheckRun } from "~/server/github";

export type CheckCategory = {
    label: string;
    color: string;
    match: (check: CheckRun) => boolean;
};

// Ordered categories for the checks breakdown, most actionable first. Each
// check is assigned to the first matching category; anything unmatched falls
// through to "other". The colors mirror the Tailwind palette used elsewhere for
// check states and drive the progress-ring arcs, the tooltip legend dots and
// the grouped checks list, so all three always agree.
export const CHECK_CATEGORIES: CheckCategory[] = [
    {
        label: "failed",
        color: "#dc2626",
        match: (c) =>
            c.conclusion === "failure" ||
            c.conclusion === "error" ||
            c.conclusion === "timed_out",
    },
    {
        label: "action required",
        color: "#ca8a04",
        match: (c) => c.conclusion === "action_required",
    },
    {
        label: "in progress",
        color: "#eab308",
        match: (c) => c.status === "in_progress",
    },
    {
        label: "queued",
        color: "#a16207",
        match: (c) => c.status === "queued",
    },
    {
        label: "passed",
        color: "#16a34a",
        match: (c) => c.conclusion === "success",
    },
    {
        label: "skipped",
        color: "#9ca3af",
        match: (c) => c.conclusion === "skipped",
    },
    {
        label: "cancelled",
        color: "#9ca3af",
        match: (c) => c.conclusion === "cancelled",
    },
    {
        label: "neutral",
        color: "#6b7280",
        match: (c) => c.conclusion === "neutral",
    },
];

export const OTHER_CATEGORY_COLOR = "#6b7280";

export type CheckGroup = {
    label: string;
    color: string;
    checks: CheckRun[];
};

/** Checks bucketed into category order; unmatched checks land under "other". */
export function bucketChecks(checks: CheckRun[]): CheckGroup[] {
    const groups: CheckGroup[] = CHECK_CATEGORIES.map((cat) => ({
        label: cat.label,
        color: cat.color,
        checks: [],
    }));
    const other: CheckRun[] = [];
    for (const check of checks) {
        const index = CHECK_CATEGORIES.findIndex((cat) => cat.match(check));
        if (index === -1) {
            other.push(check);
        } else {
            groups[index]?.checks.push(check);
        }
    }
    const result = groups.filter((group) => group.checks.length > 0);
    if (other.length > 0) {
        result.push({
            label: "other",
            color: OTHER_CATEGORY_COLOR,
            checks: other,
        });
    }
    return result;
}

export function checkBreakdown(
    checks: CheckRun[],
): { label: string; color: string; count: number }[] {
    return bucketChecks(checks).map((group) => ({
        label: group.label,
        color: group.color,
        count: group.checks.length,
    }));
}
