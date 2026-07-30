import { describe, expect, it, vi } from "vitest";

// Stub the DB module so importing api-keys.ts does not try to open a real
// postgres connection during test load. checkReportPermission itself is pure
// and never touches the db, so this stub is sufficient.
vi.mock("~/server/db", () => ({ db: {} }));

const { checkReportPermission } = await import("~/server/api-keys");

type ApiKeyPermission = Parameters<typeof checkReportPermission>[0][number];

function perm(kind: string, target: string): ApiKeyPermission {
    return {
        id: 1,
        apiKeyId: 1,
        kind,
        target,
        createdAt: new Date(0),
        updatedAt: new Date(0),
    };
}

describe("checkReportPermission", () => {
    it("returns false for an empty permissions list", () => {
        expect(checkReportPermission([], "github", "owner/repo")).toBe(false);
    });

    it("returns true when an OWNER permission matches the repository owner", () => {
        const permissions = [perm("UPLOAD_REPORT_OWNER", "github:owner")];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            true,
        );
    });

    it("returns true when a REPO permission matches the full repository", () => {
        const permissions = [perm("UPLOAD_REPORT_REPO", "github:owner/repo")];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            true,
        );
    });

    it("returns true when any permission in a mixed list matches", () => {
        const permissions = [
            perm("UPLOAD_REPORT_OWNER", "github:someone-else"),
            perm("UPLOAD_REPORT_REPO", "github:owner/repo"),
            perm("UPLOAD_REPORT_OWNER", "github:other"),
        ];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            true,
        );
    });

    it("returns false when no permission matches the provider", () => {
        const permissions = [
            perm("UPLOAD_REPORT_OWNER", "github:owner"),
            perm("UPLOAD_REPORT_REPO", "github:owner/repo"),
        ];
        expect(
            checkReportPermission(permissions, "codeberg", "owner/repo"),
        ).toBe(false);
    });

    // FIXME:
    // it("returns false when the matching owner is from a different provider than the repo permission", () => {
    //     const permissions = [
    //         perm("UPLOAD_REPORT_OWNER", "github:owner"),
    //         perm("UPLOAD_REPORT_REPO", "codeberg:owner/repo"),
    //     ];
    //     expect(
    //         checkReportPermission(permissions, "codeberg", "owner/repo"),
    //     ).toBe(false);
    // });

    it("ignores permissions with an unknown kind", () => {
        const permissions = [
            perm("READ_ONLY", "github:owner"),
            perm("UPLOAD_REPORT_OWNER", "github:different-owner"),
        ];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            false,
        );
    });

    it("returns false when the repository string is empty (owner extraction yields empty string)", () => {
        const permissions = [
            perm("UPLOAD_REPORT_OWNER", "github:owner"),
            perm("UPLOAD_REPORT_REPO", "github:owner/repo"),
        ];
        expect(checkReportPermission(permissions, "github", "")).toBe(false);
    });

    it("does not match a partial owner prefix that is not the full owner segment", () => {
        const permissions = [perm("UPLOAD_REPORT_OWNER", "github:owne")];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            false,
        );
    });

    it("uses the full repository string for REPO permission matching (not just owner)", () => {
        const permissions = [perm("UPLOAD_REPORT_REPO", "github:owner")];
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            false,
        );
    });

    it("supports different providers with the same owner name", () => {
        const permissions = [
            perm("UPLOAD_REPORT_OWNER", "codeberg:owner"),
            perm("UPLOAD_REPORT_REPO", "codeberg:owner/repo"),
        ];
        expect(
            checkReportPermission(permissions, "codeberg", "owner/repo"),
        ).toBe(true);
        expect(checkReportPermission(permissions, "github", "owner/repo")).toBe(
            false,
        );
    });
});
