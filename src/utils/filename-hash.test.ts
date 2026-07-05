import { describe, expect, it } from "vitest";
import { filenameHash } from "./filename-hash";

describe("filenameHash", () => {
    it("returns a 64-character hex string", () => {
        const hash = filenameHash("test.ts");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces deterministic output for the same filename", () => {
        expect(filenameHash("test.ts")).toBe(filenameHash("test.ts"));
    });

    it("produces different hashes for different filenames", () => {
        const h1 = filenameHash("a.ts");
        const h2 = filenameHash("b.ts");
        expect(h1).not.toBe(h2);
    });

    it("handles empty string", () => {
        const hash = filenameHash("");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles filenames with special characters", () => {
        const hash = filenameHash("path/to/file with spaces (1).tsx");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles very long filenames", () => {
        const long = `${"a/".repeat(100)}file.ts`;
        const hash = filenameHash(long);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is consistent across repeated calls", () => {
        const f = "src/components/DiffView.tsx";
        const results = Array.from({ length: 100 }, () => filenameHash(f));
        expect(new Set(results).size).toBe(1);
    });
});
