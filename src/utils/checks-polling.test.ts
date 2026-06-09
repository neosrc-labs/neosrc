import { describe, expect, it } from "vitest";
import { computeChecksPollingInterval } from "./checks-polling";

function makeCheck(status: string, conclusion: string | null = null) {
    return { name: "test", status, conclusion };
}

const openPr = {
    isMerged: false,
    isClosed: false,
    createdAt: "2025-01-15T12:00:00Z",
};
const closedPr = {
    isMerged: false,
    isClosed: true,
    createdAt: "2025-01-15T12:00:00Z",
};
const mergedPr = {
    isMerged: true,
    isClosed: false,
    createdAt: "2025-01-15T12:00:00Z",
};

const S = 5_000;
const M = 30_000;
const L = 90_000;

describe("computeChecksPollingInterval", () => {
    describe("running checks", () => {
        it("returns 5s when any check is in_progress", () => {
            const checks = [
                makeCheck("completed", "success"),
                makeCheck("in_progress"),
            ];
            expect(computeChecksPollingInterval(checks, openPr)).toBe(S);
        });

        it("returns 5s when any check is queued", () => {
            const checks = [
                makeCheck("completed", "success"),
                makeCheck("queued"),
            ];
            expect(computeChecksPollingInterval(checks, openPr)).toBe(S);
        });

        it("returns 5s when mixed running and completed", () => {
            const checks = [
                makeCheck("in_progress"),
                makeCheck("completed", "success"),
                makeCheck("queued"),
            ];
            expect(computeChecksPollingInterval(checks, openPr)).toBe(S);
        });
    });

    describe("closed / merged PR", () => {
        it("returns 90s when PR is closed and no checks running", () => {
            expect(computeChecksPollingInterval([], closedPr)).toBe(L);
            expect(
                computeChecksPollingInterval(
                    [makeCheck("completed", "success")],
                    closedPr,
                ),
            ).toBe(L);
        });

        it("returns 90s when PR is merged and no checks running", () => {
            expect(computeChecksPollingInterval([], mergedPr)).toBe(L);
        });

        it("returns 5s (not 90s) if checks are still running on closed PR", () => {
            const checks = [makeCheck("in_progress")];
            expect(computeChecksPollingInterval(checks, closedPr)).toBe(S);
        });
    });

    describe("open PR, just opened", () => {
        it("returns 5s when PR was opened less than 60s ago", () => {
            const ageMs = 30_000;
            const now = new Date("2025-01-15T12:00:00Z").getTime() + ageMs;
            expect(computeChecksPollingInterval([], openPr, now)).toBe(S);
        });

        it("returns 5s at exactly 59s", () => {
            const now = new Date("2025-01-15T12:00:59Z").getTime();
            expect(computeChecksPollingInterval([], openPr, now)).toBe(S);
        });
    });

    describe("open PR, not just opened", () => {
        it("returns 30s when PR was opened 60+ seconds ago", () => {
            const now = new Date("2025-01-15T12:01:00Z").getTime();
            expect(computeChecksPollingInterval([], openPr, now)).toBe(M);
        });

        it("returns 30s when PR was opened hours ago", () => {
            const now = new Date("2025-01-15T15:00:00Z").getTime();
            expect(computeChecksPollingInterval([], openPr, now)).toBe(M);
        });

        it("returns 30s when PR was opened days ago", () => {
            const now = new Date("2025-01-20T12:00:00Z").getTime();
            expect(computeChecksPollingInterval([], openPr, now)).toBe(M);
        });
    });

    describe("edge cases", () => {
        it("returns 30s for empty checks on open old PR", () => {
            expect(computeChecksPollingInterval([], openPr)).toBe(30_000);
        });

        it("returns 5s for empty checks on open new PR", () => {
            const now = new Date("2025-01-15T12:00:30Z").getTime();
            expect(computeChecksPollingInterval([], openPr, now)).toBe(S);
        });

        it("defaults now to Date.now() when not provided", () => {
            const result = computeChecksPollingInterval([], {
                isMerged: false,
                isClosed: false,
                createdAt: new Date(Date.now() - 10_000).toISOString(),
            });
            expect(result).toBe(S);
        });
    });
});
