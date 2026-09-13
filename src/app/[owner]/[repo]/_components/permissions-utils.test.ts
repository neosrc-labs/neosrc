import { describe, expect, it } from "vitest";
import { canInteract } from "~/app/[owner]/[repo]/_components/permissions-utils";

const base = {
    currentUser: "viewer",
    isPullRequestAuthor: false,
    repoPermission: "read" as const,
};

describe("canInteract on a locked subject", () => {
    it("lets a read-level collaborator comment on GitHub", () => {
        expect(canInteract({ ...base, isPullRequestLocked: true })).toBe(true);
    });

    it("blocks a read-level collaborator on Codeberg", () => {
        expect(
            canInteract({
                ...base,
                isPullRequestLocked: true,
                provider: "cb",
            }),
        ).toBe(false);
    });

    it("still lets a write-level collaborator comment on Codeberg", () => {
        expect(
            canInteract({
                ...base,
                isPullRequestLocked: true,
                provider: "cb",
                repoPermission: "write",
            }),
        ).toBe(true);
    });

    it("allows interaction while the subject is unlocked on either provider", () => {
        expect(
            canInteract({
                ...base,
                isPullRequestLocked: false,
                provider: "cb",
            }),
        ).toBe(true);
    });

    it("rejects signed-out viewers", () => {
        expect(
            canInteract({
                ...base,
                currentUser: null,
                isPullRequestLocked: false,
            }),
        ).toBe(false);
    });
});
