// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CheckRun } from "~/server/github";
import { ChecksSection } from "./checks-section";

function makeCheck(overrides: Partial<CheckRun> = {}): CheckRun {
    return {
        name: "ci/test",
        status: "completed",
        conclusion: "success",
        app: { name: "GitHub Actions" },
        ...overrides,
    };
}

function headings(): (string | null)[] {
    return screen
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent);
}

describe("ChecksSection", () => {
    it("groups checks by state, most actionable group first", () => {
        render(
            <ChecksSection
                checks={[
                    makeCheck({
                        name: "unit",
                        status: "queued",
                        conclusion: null,
                    }),
                    makeCheck({ name: "lint", conclusion: "failure" }),
                    makeCheck({
                        name: "build",
                        status: "in_progress",
                        conclusion: null,
                    }),
                    makeCheck({ name: "docs" }),
                ]}
            />,
        );

        expect(headings()).toEqual([
            "failed (1)",
            "in progress (1)",
            "queued (1)",
            "passed (1)",
        ]);
    });

    it("keeps every check of a state under one heading", () => {
        render(
            <ChecksSection
                checks={[
                    makeCheck({ name: "lint", conclusion: "failure" }),
                    makeCheck({ name: "e2e", conclusion: "failure" }),
                    makeCheck({ name: "unit" }),
                ]}
            />,
        );

        const group = screen.getByText("lint").closest("section");
        expect(group).not.toBeNull();
        expect(group?.querySelectorAll("a")).toHaveLength(2);
        expect(headings()).toEqual(["failed (2)", "passed (1)"]);
    });

    it("files states with no category under other", () => {
        render(
            <ChecksSection
                checks={[makeCheck({ name: "mystery", conclusion: null })]}
            />,
        );

        expect(headings()).toEqual(["other (1)"]);
        expect(screen.getByText("mystery")).toBeInTheDocument();
    });

    it("shows the empty state instead of groups when there are no checks", () => {
        render(<ChecksSection checks={[]} />);

        expect(screen.getByText("No checks")).toBeInTheDocument();
        expect(screen.queryAllByRole("heading")).toHaveLength(0);
    });

    it("shows the run duration when a check has no description", () => {
        render(
            <ChecksSection
                checks={[
                    makeCheck({
                        name: "unit",
                        started_at: "2024-01-01T00:00:00Z",
                        completed_at: "2024-01-01T00:03:00Z",
                    }),
                    makeCheck({
                        name: "e2e",
                        started_at: "2024-01-01T00:00:00Z",
                        completed_at: "2024-01-01T00:00:45Z",
                    }),
                ]}
            />,
        );

        expect(screen.getByText(/Took 3m$/)).toBeInTheDocument();
        expect(screen.getByText(/Took 45s$/)).toBeInTheDocument();
    });

    it("prefers the description over the run duration", () => {
        render(
            <ChecksSection
                checks={[
                    makeCheck({
                        name: "lint",
                        description: "2 warnings",
                        started_at: "2024-01-01T00:00:00Z",
                        completed_at: "2024-01-01T00:03:00Z",
                    }),
                ]}
            />,
        );

        expect(screen.getByText(/- 2 warnings$/)).toBeInTheDocument();
        expect(screen.queryByText(/Took/)).toBeNull();
    });
});
