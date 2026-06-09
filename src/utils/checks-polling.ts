import type { CheckRun } from "~/server/github";

export type CheckStatusRollup =
    | "SUCCESS"
    | "FAILURE"
    | "ERROR"
    | "TIMED_OUT"
    | "CANCELLED"
    | "SKIPPED_"
    | "IN_PROGRESS"
    | "PENDING"
    | "NEUTRAL";

export function computeCheckStatusRollup(
    checks: CheckRun[],
): CheckStatusRollup | null {
    if (!checks.length) return null;

    const hasFailure = checks.some(
        (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
    );
    if (hasFailure) return "FAILURE";

    const hasCancelled = checks.some((c) => c.conclusion === "cancelled");
    if (hasCancelled) return "CANCELLED";

    const hasInProgress = checks.some(
        (c) => c.status === "in_progress" || c.status === "queued",
    );
    if (hasInProgress) return "IN_PROGRESS";

    const allSuccess = checks.every((c) => c.conclusion === "success");
    if (allSuccess) return "SUCCESS";

    return "NEUTRAL";
}

export function computeChecksPollingInterval(
    checks: CheckRun[],
    prState: {
        isMerged: boolean;
        isClosed: boolean;
        createdAt: string;
    },
    now: number = Date.now(),
): number {
    const hasRunning = checks.some(
        (c) => c.status === "in_progress" || c.status === "queued",
    );
    if (hasRunning) return 5_000;

    if (prState.isMerged || prState.isClosed) return 90_000;

    const ageMs = now - new Date(prState.createdAt).getTime();
    if (ageMs < 60_000) return 5_000;

    return 30_000;
}
