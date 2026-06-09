import type { CheckRun } from "~/server/github";

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
