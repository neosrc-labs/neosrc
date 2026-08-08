import { describe, expect, it } from "vitest";
import { getFileIconName, getFolderIconName } from "./icons";

describe("getFileIconName", () => {
    it("maps a known extension to its material icon", () => {
        expect(getFileIconName("foo.ts")).toBe("typescript");
    });

    it("maps a dotfile extension case-insensitively", () => {
        expect(getFileIconName("README.MD")).toBe("markdown");
    });

    it("falls back to file for unknown extensions", () => {
        expect(getFileIconName("foo.xyz")).toBe("file");
    });

    it("falls back to file when there is no extension", () => {
        expect(getFileIconName("README")).toBe("file");
    });
});

describe("getFolderIconName", () => {
    it("maps a known folder name to its material icon", () => {
        expect(getFolderIconName("src")).toBe("folder-src");
        expect(getFolderIconName("fixtures")).toBe("folder-mock");
        expect(getFolderIconName("e2e")).toBe("folder-coverage");
    });

    it("resolves hidden, private, and wrapped name variants", () => {
        expect(getFolderIconName(".github")).toBe("folder-github");
        expect(getFolderIconName("__tests__")).toBe("folder-test");
        expect(getFolderIconName("_posts")).toBe("folder-docs");
    });

    it("matches folder names case-insensitively", () => {
        expect(getFolderIconName("SRC")).toBe("folder-src");
        expect(getFolderIconName("Fixtures")).toBe("folder-mock");
    });

    it("matches nested folder paths for compressed tree nodes", () => {
        expect(getFolderIconName(".github/workflows")).toBe(
            "folder-gh-workflows",
        );
        expect(getFolderIconName("prisma/schema")).toBe("folder-prisma");
    });

    it("resolves icons only shipped as clone variants", () => {
        expect(getFolderIconName("deprecated")).toBe("folder-deprecated.clone");
    });

    it("falls back to the plain folder icon", () => {
        expect(getFolderIconName("compiler")).toBe("folder");
        expect(getFolderIconName(".codesandbox")).toBe("folder");
    });

    it("appends -open for expanded folders", () => {
        expect(getFolderIconName("src", true)).toBe("folder-src-open");
        expect(getFolderIconName(".github/workflows", true)).toBe(
            "folder-gh-workflows-open",
        );
        expect(getFolderIconName("__tests__", true)).toBe("folder-test-open");
    });

    it("falls back to folder-open when expanded and unmatched", () => {
        expect(getFolderIconName("compiler", true)).toBe("folder-open");
    });
});
