import { describe, expect, it } from "vitest";
import {
    eventLabel,
    runDurationLabel,
    runStatusLabel,
} from "~/app/[owner]/[repo]/actions/_components/actions-display";
import type { WorkflowRunItem } from "~/server/api/routers/actions/types";

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
    });

    it("returns null for a successful run so the row shows its duration", () => {
        expect(runStatusLabel("completed", "success")).toBeNull();
    });

    it("labels an unsuccessful run by its conclusion", () => {
        expect(runStatusLabel("completed", "failure")).toBe("Failure");
        expect(runStatusLabel("completed", "cancelled")).toBe("Cancelled");
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
