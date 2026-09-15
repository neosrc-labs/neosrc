import { describe, expect, it } from "vitest";
import {
    eventLabel,
    runDurationLabel,
    runPullRequestNumber,
    runStatusLabel,
    statusLabel,
} from "~/components/actions/actions-display";
import {
    FORGEJO_RUN_STATUS_VALUES,
    GITHUB_RUN_STATUS_VALUES,
    isWorkflowRunStatus,
    type WorkflowRunItem,
} from "~/server/api/routers/actions/types";

function makeRun(overrides: Partial<WorkflowRunItem>): WorkflowRunItem {
    return {
        id: 1,
        name: "CI",
        runNumber: 42,
        displayTitle: "Some commit",
        event: "push",
        status: "completed",
        conclusion: "success",
        branch: "main",
        actor: { login: "octocat", avatarUrl: "https://example.com/a.png" },
        pullRequestNumber: null,
        createdAt: "2024-01-01T00:00:00Z",
        runStartedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:01:30Z",
        htmlUrl: "https://github.com/o/r/actions/runs/1",
        ...overrides,
    };
}

describe("runStatusLabel", () => {
    it("labels an unfinished run by its status", () => {
        expect(runStatusLabel("queued", null)).toBe("Queued");
        expect(runStatusLabel("in_progress", null)).toBe("In progress");
    });

    it("calls out runs waiting on a human", () => {
        expect(runStatusLabel("completed", "action_required")).toBe(
            "Action required",
        );
        // Forgejo reports a run blocked on approval as a status, not a
        // conclusion, and it has to read the same way.
        expect(runStatusLabel("queued", "action_required")).toBe(
            "Action required",
        );
    });

    it("returns null for a successful run so the row shows its duration", () => {
        expect(runStatusLabel("completed", "success")).toBeNull();
    });

    it("labels an unsuccessful run by its conclusion", () => {
        expect(runStatusLabel("completed", "failure")).toBe("Failure");
        expect(runStatusLabel("completed", "cancelled")).toBe("Cancelled");
    });
});

describe("statusLabel", () => {
    it("labels a status value", () => {
        expect(statusLabel("blocked")).toBe("Blocked");
        expect(statusLabel("timed_out")).toBe("Timed out");
    });

    it("humanizes a status with no curated label", () => {
        expect(statusLabel("some_new_status")).toBe("some new status");
    });
});

describe("status vocabulary", () => {
    it("accepts every value either provider reports", () => {
        for (const value of [
            ...GITHUB_RUN_STATUS_VALUES,
            ...FORGEJO_RUN_STATUS_VALUES,
        ]) {
            expect(isWorkflowRunStatus(value)).toBe(true);
        }
    });
});

describe("eventLabel", () => {
    it("uses the curated label when one exists", () => {
        expect(eventLabel("pull_request")).toBe("Pull request");
    });

    it("humanizes an unknown event name", () => {
        expect(eventLabel("some_new_event")).toBe("some new event");
    });
});

describe("runPullRequestNumber", () => {
    it("returns the pull request for a PR-triggered run", () => {
        expect(
            runPullRequestNumber(
                makeRun({ event: "pull_request", pullRequestNumber: 42 }),
            ),
        ).toBe(42);
        expect(
            runPullRequestNumber(
                makeRun({
                    event: "pull_request_target",
                    pullRequestNumber: 42,
                }),
            ),
        ).toBe(42);
    });

    it("ignores the branch-matched pull requests GitHub reports for a push", () => {
        expect(
            runPullRequestNumber(
                makeRun({ event: "push", pullRequestNumber: 1 }),
            ),
        ).toBeNull();
    });

    it("returns null when the run has no pull request", () => {
        expect(runPullRequestNumber(makeRun({ event: "schedule" }))).toBeNull();
    });
});

describe("runDurationLabel", () => {
    it("formats the elapsed time of a finished run", () => {
        expect(runDurationLabel(makeRun({}))).toBe("1m 30s");
    });

    it("returns null while a run is still going", () => {
        expect(
            runDurationLabel(
                makeRun({ status: "in_progress", conclusion: null }),
            ),
        ).toBeNull();
    });

    it("returns null when the run never reported a start time", () => {
        expect(runDurationLabel(makeRun({ runStartedAt: null }))).toBeNull();
    });
});
