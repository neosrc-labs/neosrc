import { describe, expect, it } from "vitest";
import { repoPermissionsToRelation } from "~/server/sync/shared";

const perms = (
    overrides: Partial<{
        admin: boolean;
        maintain: boolean;
        push: boolean;
        triage: boolean;
        pull: boolean;
    }> = {},
) => ({
    admin: false,
    maintain: false,
    push: false,
    triage: false,
    pull: false,
    ...overrides,
});

describe("repoPermissionsToRelation", () => {
    it("returns null when the user has no access", () => {
        expect(repoPermissionsToRelation(perms())).toBeNull();
    });

    it("maps every permission flag to the relation vocabulary", () => {
        expect(repoPermissionsToRelation(perms({ admin: true }))).toBe("admin");
        expect(repoPermissionsToRelation(perms({ maintain: true }))).toBe(
            "maintainer",
        );
        expect(repoPermissionsToRelation(perms({ push: true }))).toBe("writer");
        expect(repoPermissionsToRelation(perms({ triage: true }))).toBe(
            "triager",
        );
        expect(repoPermissionsToRelation(perms({ pull: true }))).toBe("reader");
    });

    it("returns the strongest permission when several flags are set", () => {
        expect(
            repoPermissionsToRelation(
                perms({ push: true, pull: true, triage: true }),
            ),
        ).toBe("writer");
        expect(
            repoPermissionsToRelation(
                perms({ admin: true, maintain: true, pull: true }),
            ),
        ).toBe("admin");
        expect(
            repoPermissionsToRelation(perms({ maintain: true, push: true })),
        ).toBe("maintainer");
    });
});
