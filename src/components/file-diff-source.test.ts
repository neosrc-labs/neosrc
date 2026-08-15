import { describe, expect, it } from "vitest";
import {
    buildRawContentUrls,
    resolveFileDiffPresentation,
} from "./file-diff-source";

const base = {
    filename: "src/example.ts",
    patch: null,
    status: "modified",
    performanceHidden: false,
    showPerformanceDiff: true,
    additions: 1,
    deletions: 1,
};

describe("file diff source policy", () => {
    it("preserves old/new raw URL rules for added, removed, and renamed files", () => {
        expect(
            buildRawContentUrls({
                ...base,
                status: "added",
                owner: "o",
                repo: "r",
                baseSha: "b",
                headSha: "h",
            }),
        ).toEqual({
            oldUrl: null,
            newUrl: "/api/raw?owner=o&repo=r&sha=h&path=src%2Fexample.ts",
        });
        expect(
            buildRawContentUrls({
                ...base,
                status: "removed",
                owner: "o",
                repo: "r",
                baseSha: "b",
                headSha: "h",
            }),
        ).toEqual({
            oldUrl: "/api/raw?owner=o&repo=r&sha=b&path=src%2Fexample.ts",
            newUrl: null,
        });
        expect(
            buildRawContentUrls({
                ...base,
                status: "renamed",
                previousFilename: "old.ts",
                owner: "o",
                repo: "r",
                baseSha: "b",
                headSha: "h",
            }),
        ).toEqual({
            oldUrl: "/api/raw?owner=o&repo=r&sha=b&path=old.ts",
            newUrl: "/api/raw?owner=o&repo=r&sha=h&path=src%2Fexample.ts",
        });
    });

    it("applies performance, media, patch, and fallback precedence", () => {
        expect(
            resolveFileDiffPresentation({
                ...base,
                performanceHidden: true,
                showPerformanceDiff: false,
            }),
        ).toBe("hidden");
        expect(
            resolveFileDiffPresentation({
                ...base,
                filename: "icon.svg",
                patch: "@@",
            }),
        ).toBe("svg");
        expect(resolveFileDiffPresentation({ ...base, patch: "@@" })).toBe(
            "code",
        );
        expect(
            resolveFileDiffPresentation({
                ...base,
                filename: "photo.png",
                baseSha: "b",
            }),
        ).toBe("image");
        expect(
            resolveFileDiffPresentation({ ...base, status: "renamed" }),
        ).toBe("renamed");
        expect(
            resolveFileDiffPresentation({
                ...base,
                additions: 0,
                deletions: 0,
            }),
        ).toBe("whitespace");
        expect(
            resolveFileDiffPresentation({ ...base, baseSha: undefined }),
        ).toBe("binary");
    });
});
