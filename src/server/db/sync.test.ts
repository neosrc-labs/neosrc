import { describe, expect, it, vi } from "vitest";

import {
    codebergRepoPermissionsToRelation,
    githubRepoPermissionsToRelation,
} from "~/server/db/sync";

// The provider modules only do network calls, which these pure-mapper tests
// never reach; stubbing them keeps the import side-effect free.
vi.mock("~/server/github", () => ({}));
vi.mock("~/server/codeberg", () => ({}));

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

describe("githubRepoPermissionsToRelation", () => {
    it("returns null when the user has no access", () => {
        expect(githubRepoPermissionsToRelation(perms())).toBeNull();
    });

    it("maps each permission flag to the relation vocabulary", () => {
        expect(githubRepoPermissionsToRelation(perms({ admin: true }))).toBe(
            "admin",
        );
        expect(githubRepoPermissionsToRelation(perms({ maintain: true }))).toBe(
            "maintainer",
        );
        expect(githubRepoPermissionsToRelation(perms({ push: true }))).toBe(
            "writer",
        );
        expect(githubRepoPermissionsToRelation(perms({ triage: true }))).toBe(
            "triager",
        );
        expect(githubRepoPermissionsToRelation(perms({ pull: true }))).toBe(
            "reader",
        );
    });

    it("returns the highest permission when several flags are set", () => {
        expect(
            githubRepoPermissionsToRelation(
                perms({ push: true, pull: true, triage: true }),
            ),
        ).toBe("writer");
        expect(
            githubRepoPermissionsToRelation(
                perms({ admin: true, maintain: true, pull: true }),
            ),
        ).toBe("admin");
    });
});

describe("codebergRepoPermissionsToRelation", () => {
    it("returns null when the user has no access", () => {
        expect(codebergRepoPermissionsToRelation(perms())).toBeNull();
    });

    it("maps each permission flag to the relation vocabulary", () => {
        expect(codebergRepoPermissionsToRelation(perms({ admin: true }))).toBe(
            "admin",
        );
        expect(codebergRepoPermissionsToRelation(perms({ push: true }))).toBe(
            "writer",
        );
        expect(codebergRepoPermissionsToRelation(perms({ pull: true }))).toBe(
            "reader",
        );
    });

    it("returns the highest permission when several flags are set", () => {
        expect(
            codebergRepoPermissionsToRelation(
                perms({ admin: true, push: true, pull: true }),
            ),
        ).toBe("admin");
    });
});
