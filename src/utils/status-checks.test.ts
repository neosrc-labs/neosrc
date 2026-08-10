import { describe, expect, it } from "vitest";
import {
    type CommitStatus,
    deduplicateCommitStatuses,
    mapStatusToCheckRun,
} from "./status-checks";

function makeStatus(overrides: Partial<CommitStatus> = {}): CommitStatus {
    return {
        state: "success",
        target_url: null,
        description: "All good",
        context: "ci/build",
        created_at: "2025-01-15T12:00:00Z",
        updated_at: "2025-01-15T12:05:00Z",
        creator: null,
        ...overrides,
    };
}

describe("mapStatusToCheckRun", () => {
    it("maps pending state to in_progress with null conclusion", () => {
        const result = mapStatusToCheckRun(
            makeStatus({
                state: "pending",
                created_at: "2025-01-15T12:00:00Z",
                updated_at: "2025-01-15T12:05:00Z",
            }),
        );
        expect(result.name).toBe("ci/build");
        expect(result.conclusion).toBeNull();
        expect(result.status).toBe("in_progress");
        expect(result.completed_at).toBeNull();
        expect(result.started_at).toBe("2025-01-15T12:00:00Z");
    });

    it("maps success state to success conclusion and completed status", () => {
        const result = mapStatusToCheckRun(makeStatus({ state: "success" }));
        expect(result.conclusion).toBe("success");
        expect(result.status).toBe("completed");
        expect(result.completed_at).toBe("2025-01-15T12:05:00Z");
    });

    it("maps error state to failure conclusion and completed status", () => {
        const result = mapStatusToCheckRun(makeStatus({ state: "error" }));
        expect(result.conclusion).toBe("failure");
        expect(result.status).toBe("completed");
        expect(result.completed_at).toBe("2025-01-15T12:05:00Z");
    });

    it("maps failure state to failure conclusion and completed status", () => {
        const result = mapStatusToCheckRun(makeStatus({ state: "failure" }));
        expect(result.conclusion).toBe("failure");
        expect(result.status).toBe("completed");
        expect(result.completed_at).toBe("2025-01-15T12:05:00Z");
    });

    it("passes the context through as the check name", () => {
        const result = mapStatusToCheckRun(
            makeStatus({ context: "lint/typescript" }),
        );
        expect(result.name).toBe("lint/typescript");
    });

    it("maps description through unchanged", () => {
        const result = mapStatusToCheckRun(
            makeStatus({ description: "13 tests passed" }),
        );
        expect(result.description).toBe("13 tests passed");
    });

    it("preserves null description", () => {
        const result = mapStatusToCheckRun(makeStatus({ description: null }));
        expect(result.description).toBeNull();
    });

    it("maps target_url to html_url when present", () => {
        const result = mapStatusToCheckRun(
            makeStatus({ target_url: "https://ci.example.com/job/123" }),
        );
        expect(result.html_url).toBe("https://ci.example.com/job/123");
    });

    it("converts null target_url to undefined html_url", () => {
        const result = mapStatusToCheckRun(makeStatus({ target_url: null }));
        expect(result.html_url).toBeUndefined();
    });

    it("always sets details_url to null", () => {
        const result = mapStatusToCheckRun(makeStatus());
        expect(result.details_url).toBeNull();
    });

    it("always sets app to null (commit statuses have no app)", () => {
        const result = mapStatusToCheckRun(makeStatus());
        expect(result.app).toBeNull();
    });

    it("maps creator through unchanged when present", () => {
        const creator = {
            login: "ross",
            avatar_url: "https://avatars.githubusercontent.com/u/1",
            html_url: "https://github.com/ross",
        };
        const result = mapStatusToCheckRun(makeStatus({ creator }));
        expect(result.creator).toEqual(creator);
    });

    it("preserves null creator", () => {
        const result = mapStatusToCheckRun(makeStatus({ creator: null }));
        expect(result.creator).toBeNull();
    });
});

describe("deduplicateCommitStatuses", () => {
    it("returns empty array for empty input", () => {
        expect(deduplicateCommitStatuses([])).toEqual([]);
    });

    it("returns the single status unchanged", () => {
        const status = makeStatus();
        expect(deduplicateCommitStatuses([status])).toEqual([status]);
    });

    it("keeps statuses for distinct contexts", () => {
        const a = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:00:00Z",
        });
        const b = makeStatus({
            context: "ci/lint",
            updated_at: "2025-01-15T12:00:00Z",
        });
        const result = deduplicateCommitStatuses([a, b]);
        expect(result).toHaveLength(2);
        expect(result.map((s) => s.context).sort()).toEqual([
            "ci/build",
            "ci/lint",
        ]);
    });

    it("keeps the latest status per context by updated_at", () => {
        const older = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:00:00Z",
            description: "older",
        });
        const newer = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:05:00Z",
            description: "newer",
        });
        const result = deduplicateCommitStatuses([older, newer]);
        expect(result).toHaveLength(1);
        expect(result[0]?.description).toBe("newer");
    });

    it("keeps the earlier status when the later one is older", () => {
        const older = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:00:00Z",
            description: "older",
        });
        const newer = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:05:00Z",
            description: "newer",
        });
        const result = deduplicateCommitStatuses([newer, older]);
        expect(result).toHaveLength(1);
        expect(result[0]?.description).toBe("newer");
    });

    it("on equal updated_at, the later array element wins", () => {
        const a = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:00:00Z",
            description: "first-in-array",
        });
        const b = makeStatus({
            context: "ci/build",
            updated_at: "2025-01-15T12:00:00Z",
            description: "second-in-array",
        });
        const result = deduplicateCommitStatuses([a, b]);
        expect(result).toHaveLength(1);
        expect(result[0]?.description).toBe("second-in-array");
    });

    it("dedupes across mixed contexts and timestamps", () => {
        const statuses = [
            makeStatus({
                context: "ci/build",
                updated_at: "2025-01-15T12:00:00Z",
                description: "build-v1",
            }),
            makeStatus({
                context: "ci/lint",
                updated_at: "2025-01-15T12:01:00Z",
                description: "lint-v1",
            }),
            makeStatus({
                context: "ci/build",
                updated_at: "2025-01-15T12:05:00Z",
                description: "build-v2",
            }),
            makeStatus({
                context: "ci/lint",
                updated_at: "2025-01-15T12:04:00Z",
                description: "lint-v2",
            }),
            makeStatus({
                context: "ci/test",
                updated_at: "2025-01-15T12:03:00Z",
                description: "test-v1",
            }),
        ];
        const result = deduplicateCommitStatuses(statuses);
        expect(result).toHaveLength(3);
        const byContext = new Map(result.map((s) => [s.context, s]));
        expect(byContext.get("ci/build")?.description).toBe("build-v2");
        expect(byContext.get("ci/lint")?.description).toBe("lint-v2");
        expect(byContext.get("ci/test")?.description).toBe("test-v1");
    });

    it("deduplicates commit statuses with identical timestamps (last wins)", () => {
        const statuses = [
            makeStatus({
                context: "ci/test",
                state: "failure",
                updated_at: "2025-01-15T12:00:00Z",
            }),
            makeStatus({
                context: "ci/test",
                state: "success",
                updated_at: "2025-01-15T12:00:00Z",
            }),
        ];
        const result = deduplicateCommitStatuses(statuses);
        expect(result).toHaveLength(1);
        expect(result[0]?.state).toBe("success");
    });
});
