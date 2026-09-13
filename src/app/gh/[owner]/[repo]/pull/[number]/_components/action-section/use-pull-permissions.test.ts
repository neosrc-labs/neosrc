import { describe, expect, it } from "vitest";
import type { PullRequestPermissionContext } from "~/app/[owner]/[repo]/_components/permissions-utils";
import type { PullsGetResponseData } from "~/server/github";
import { usePullPermissions } from "./use-pull-permissions";

const pullRequest = {
    mergeable_state: "clean",
    stack: null,
} as unknown as PullsGetResponseData;

function permissions(
    overrides: Partial<PullRequestPermissionContext>,
): PullRequestPermissionContext {
    return {
        currentUser: "ranger-ross",
        isPullRequestAuthor: false,
        isPullRequestLocked: false,
        repoPermission: null,
        provider: "gh",
        ...overrides,
    };
}

describe("usePullPermissions merge access", () => {
    it("reports an unresolved permission instead of a denial", () => {
        const { canMerge, isMergePermissionUnknown } = usePullPermissions(
            permissions({ repoPermission: null }),
            pullRequest,
        );

        expect(canMerge).toBe(false);
        expect(isMergePermissionUnknown).toBe(true);
    });

    it("treats a read grant as a resolved denial", () => {
        const { canMerge, isMergePermissionUnknown } = usePullPermissions(
            permissions({ repoPermission: "read" }),
            pullRequest,
        );

        expect(canMerge).toBe(false);
        expect(isMergePermissionUnknown).toBe(false);
    });

    it("treats a signed-out viewer as a denial, not an unresolved lookup", () => {
        const { canMerge, isMergePermissionUnknown } = usePullPermissions(
            permissions({ currentUser: null }),
            pullRequest,
        );

        expect(canMerge).toBe(false);
        expect(isMergePermissionUnknown).toBe(false);
    });

    it("allows merging with write access", () => {
        const { canMerge, isMergePermissionUnknown } = usePullPermissions(
            permissions({ repoPermission: "write" }),
            pullRequest,
        );

        expect(canMerge).toBe(true);
        expect(isMergePermissionUnknown).toBe(false);
    });
});
