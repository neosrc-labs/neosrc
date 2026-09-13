// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PullsGetResponseData } from "~/server/github";
import { MergeStatusBar } from "./merge-status-bar";

function pullRequest(): PullsGetResponseData {
    return { mergeable_state: "clean" } as unknown as PullsGetResponseData;
}

function renderBar(canMerge: boolean, isMergePermissionUnknown: boolean): void {
    render(
        <MergeStatusBar
            pullRequest={pullRequest()}
            isDraft={false}
            canMerge={canMerge}
            canWrite={canMerge}
            mergeMode="merge"
            onMergeModeChange={vi.fn()}
            onMerge={vi.fn()}
            isMerging={false}
            availableMergeOptions={[
                {
                    value: "merge",
                    label: "Merge",
                    description: "Merge commit",
                    allowed: true,
                },
            ]}
            isMergeBlocked={false}
            isMergeStateUnknown={false}
            isMergePermissionUnknown={isMergePermissionUnknown}
            noMergeMethodsAvailable={false}
            mergeError={false}
            isMergeRequirementsUnavailable={false}
            isMergeStatusLoading={false}
        />,
    );
}

describe("MergeStatusBar permission copy", () => {
    it("offers the merge button when the viewer may merge", () => {
        renderBar(true, false);

        expect(
            screen.getByRole("button", { name: /merge pull request/i }),
        ).toBeDefined();
    });

    it("states the viewer lacks permission only on a resolved denial", () => {
        renderBar(false, false);

        expect(
            screen.getByText(/don't have permission to merge/i),
        ).toBeDefined();
    });

    it("admits an unresolved lookup instead of claiming no permission", () => {
        renderBar(false, true);

        expect(
            screen.getByText(/couldn't determine your merge permissions/i),
        ).toBeDefined();
        expect(
            screen.queryByText(/don't have permission to merge/i),
        ).toBeNull();
    });
});
