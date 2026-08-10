import { describe, expect, it, vi } from "vitest";
import { buildSuggestionNewContent } from "~/server/github";

// Stub the DB and env modules so importing github.ts does not open a real
// postgres connection or validate env vars during test load.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({
    env: {
        BETTER_AUTH_SECRET: "test-secret",
        BETTER_AUTH_URL: "http://localhost:3000",
        GITHUB_CLIENT_ID: "test",
        GITHUB_CLIENT_SECRET: "test",
        CODEBERG_CLIENT_ID: "test",
        CODEBERG_CLIENT_SECRET: "test",
        DATABASE_URL: "postgres://localhost:5432/neosrc",
        NODE_ENV: "test",
    },
}));

describe("buildSuggestionNewContent", () => {
    it("replaces a single line in place", () => {
        const content = "alpha\nbeta\ngamma\n";
        const result = buildSuggestionNewContent(content, "BETA", 2, 2);
        expect(result).toBe("alpha\nBETA\ngamma\n");
    });

    it("replaces a multi-line range with a multi-line suggestion", () => {
        const content = "alpha\nbeta\ngamma\ndelta\n";
        const result = buildSuggestionNewContent(content, "BETA\nGAMMA", 3, 2);
        expect(result).toBe("alpha\nBETA\nGAMMA\ndelta\n");
    });

    it("defaults startLine to line when only line is provided", () => {
        const content = "alpha\nbeta\ngamma\n";
        const result = buildSuggestionNewContent(content, "BETA", 2, undefined);
        expect(result).toBe("alpha\nBETA\ngamma\n");
    });

    it("defaults startLine to line when startLine is null", () => {
        const content = "alpha\nbeta\ngamma\n";
        const result = buildSuggestionNewContent(content, "BETA", 2, null);
        expect(result).toBe("alpha\nBETA\ngamma\n");
    });

    it("strips a single trailing newline from the suggestion", () => {
        const content = "alpha\nbeta\ngamma\n";
        const result = buildSuggestionNewContent(content, "BETA\n", 2, 2);
        expect(result).toBe("alpha\nBETA\ngamma\n");
    });

    it("replaces with a multi-line suggestion that ends in a newline", () => {
        const content = "alpha\nbeta\ngamma\n";
        const result = buildSuggestionNewContent(
            content,
            "BETA\nGAMMA\n",
            2,
            2,
        );
        expect(result).toBe("alpha\nBETA\nGAMMA\ngamma\n");
    });

    it("preserves the trailing newline of the file", () => {
        const content = "alpha\nbeta\n";
        const result = buildSuggestionNewContent(content, "BETA\n", 2, 2);
        expect(result).toBe("alpha\nBETA\n");
    });

    it("does not add a newline when the file has no trailing newline", () => {
        const content = "alpha\nbeta";
        const result = buildSuggestionNewContent(content, "BETA\n", 2, 2);
        expect(result).toBe("alpha\nBETA");
    });

    it("preserves CRLF line endings on untouched lines", () => {
        const content = "alpha\r\nbeta\r\ngamma\r\n";
        const result = buildSuggestionNewContent(content, "BETA\n", 2, 2);
        expect(result).toBe("alpha\r\nBETA\r\ngamma\r\n");
    });

    it("joins suggestion lines with the file's CRLF ending", () => {
        const content = "alpha\r\nbeta\r\ngamma\r\n";
        const result = buildSuggestionNewContent(
            content,
            "BETA\nGAMMA\n",
            2,
            2,
        );
        expect(result).toBe("alpha\r\nBETA\r\nGAMMA\r\ngamma\r\n");
    });

    it("throws when the range starts before the first line", () => {
        expect(() =>
            buildSuggestionNewContent("alpha\nbeta\n", "X", 1, 0),
        ).toThrow(/out of bounds/);
    });

    it("throws when the range ends past the last line", () => {
        expect(() =>
            buildSuggestionNewContent("alpha\nbeta\n", "X", 5, 5),
        ).toThrow(/out of bounds/);
    });

    it("throws when startLine is after line", () => {
        expect(() =>
            buildSuggestionNewContent("alpha\nbeta\n", "X", 1, 2),
        ).toThrow(/out of bounds/);
    });

    it("throws when no line is provided", () => {
        expect(() =>
            buildSuggestionNewContent(
                "alpha\nbeta\n",
                "X",
                undefined,
                undefined,
            ),
        ).toThrow(/out of bounds/);
    });
});
