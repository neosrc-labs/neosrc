import { describe, expect, it } from "vitest";
import { approvalHasWriteAccess } from "./utils";

describe("approvalHasWriteAccess", () => {
    it("is true for admin and write permissions", () => {
        expect(approvalHasWriteAccess("admin")).toBe(true);
        expect(approvalHasWriteAccess("write")).toBe(true);
    });

    it("is false for read and no access", () => {
        expect(approvalHasWriteAccess("read")).toBe(false);
        expect(approvalHasWriteAccess("none")).toBe(false);
    });

    it("keeps the green check when the permission is unknown", () => {
        expect(approvalHasWriteAccess(undefined)).toBe(true);
    });
});
