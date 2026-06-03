import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocking
// The module reads env and derives KEY at load time, so we must mock `~/env`
// before the module is imported. We use vi.mock (hoisted) + vi.doMock for the
// per-test invalid-key scenarios that require fresh module loads.
// ---------------------------------------------------------------------------

vi.mock("~/env", () => ({
    env: {
        DATA_ENCRYPTION_KEY:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
}));

// Import AFTER mock is in place
import { decrypt, encrypt } from "./encryption";

/** Flip one bit in a base64url-encoded payload at the given byte offset. */
function tamperByte(encoded: string, byteOffset: number): string {
    const buf = Buffer.from(encoded, "base64url");
    // @ts-expect-error: This is just a test
    buf[byteOffset] ^= 0xff;
    return buf.toString("base64url");
}

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

describe("encrypt()", () => {
    it("returns a non-empty base64url string", () => {
        const result = encrypt("hello");
        expect(result).toBeTypeOf("string");
        expect(result.length).toBeGreaterThan(0);
        // base64url alphabet: A-Z a-z 0-9 - _  (no + / or =)
        expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
        const a = encrypt("same plaintext");
        const b = encrypt("same plaintext");
        expect(a).not.toBe(b);
    });

    it("encodes the correct minimum byte length (IV + tag + ciphertext)", () => {
        const plaintext = "hello";
        const encoded = encrypt(plaintext);
        const buf = Buffer.from(encoded, "base64url");
        const minExpected =
            IV_LENGTH + TAG_LENGTH + Buffer.byteLength(plaintext, "utf8");
        expect(buf.length).toBe(minExpected);
    });

    it("handles an empty string", () => {
        const result = encrypt("");
        expect(result).toBeTypeOf("string");
        // Empty plaintext → payload is exactly IV + tag bytes
        const buf = Buffer.from(result, "base64url");
        expect(buf.length).toBe(IV_LENGTH + TAG_LENGTH);
    });

    it("handles a long string", () => {
        const long = "x".repeat(10_000);
        const result = encrypt(long);
        const buf = Buffer.from(result, "base64url");
        expect(buf.length).toBe(IV_LENGTH + TAG_LENGTH + 10_000);
    });

    it("handles multi-byte UTF-8 characters", () => {
        const unicode = "こんにちは 🌍";
        const result = encrypt(unicode);
        expect(result).toBeTypeOf("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("handles strings containing special/delimiter characters", () => {
        // Ensures the binary format is robust against payloads that would
        // break a delimiter-based scheme (e.g. colons, slashes).
        const tricky = "a:b:c / d=e+f?g&h";
        expect(() => encrypt(tricky)).not.toThrow();
    });
});

describe("decrypt()", () => {
    it("round-trips a basic string", () => {
        const plaintext = "hello, world";
        expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("round-trips an empty string", () => {
        expect(decrypt(encrypt(""))).toBe("");
    });

    it("round-trips a long string", () => {
        const long = "a".repeat(10_000);
        expect(decrypt(encrypt(long))).toBe(long);
    });

    it("round-trips multi-byte UTF-8 content", () => {
        const text = "日本語テスト 🔐";
        expect(decrypt(encrypt(text))).toBe(text);
    });

    it("round-trips strings with special characters", () => {
        const text = "Special: <>\"'&\n\t\r";
        expect(decrypt(encrypt(text))).toBe(text);
    });

    it("produces independent results across multiple calls", () => {
        const a = encrypt("foo");
        const b = encrypt("bar");
        expect(decrypt(a)).toBe("foo");
        expect(decrypt(b)).toBe("bar");
    });

    // --- Tampered IV ---
    it("throws when the IV is tampered", () => {
        const encrypted = encrypt("sensitive data");
        const tampered = tamperByte(encrypted, 0); // flip first IV byte
        expect(() => decrypt(tampered)).toThrow("Decryption failed");
    });

    // --- Tampered auth tag ---
    it("throws when the auth tag is tampered", () => {
        const encrypted = encrypt("sensitive data");
        const tampered = tamperByte(encrypted, IV_LENGTH); // first tag byte
        expect(() => decrypt(tampered)).toThrow(/authentication tag mismatch/);
    });

    // --- Tampered ciphertext ---
    it("throws when the ciphertext is tampered", () => {
        const encrypted = encrypt("sensitive data");
        const tampered = tamperByte(encrypted, IV_LENGTH + TAG_LENGTH); // first ciphertext byte
        expect(() => decrypt(tampered)).toThrow("Decryption failed");
    });

    // --- Short / truncated input ---
    it("throws when the input is too short to contain IV + tag", () => {
        const tooShort = Buffer.alloc(IV_LENGTH + TAG_LENGTH - 1).toString(
            "base64url",
        );
        expect(() => decrypt(tooShort)).toThrow(/input too short/);
    });

    it("throws on an empty string input", () => {
        expect(() => decrypt("")).toThrow(/input too short/);
    });

    // --- Garbled input ---
    it("throws on completely garbled input", () => {
        expect(() => decrypt("not-valid-encrypted-data-at-all-!!")).toThrow(
            "Decryption failed",
        );
    });

    // --- Error shape ---
    it("throws an Error instance (not a string or unknown)", () => {
        try {
            decrypt("tooshort");
        } catch (err) {
            expect(err).toBeInstanceOf(Error);
        }
    });

    it("preserves the original error as .cause on auth-tag failure", () => {
        const encrypted = encrypt("data");
        const tampered = tamperByte(encrypted, IV_LENGTH);
        try {
            decrypt(tampered);
            expect.fail("Expected decrypt to throw");
        } catch (err) {
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).cause).toBeDefined();
        }
    });

    it("does NOT silently return the ciphertext on failure", () => {
        const encrypted = encrypt("secret");
        const tampered = tamperByte(encrypted, IV_LENGTH);
        // The old code returned `encrypted` on failure — make sure we throw instead
        expect(() => decrypt(tampered)).toThrow();
    });
});

// ---------------------------------------------------------------------------
// Key validation (requires re-importing the module with a different env mock)
// ---------------------------------------------------------------------------

describe("KEY validation at module load", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws when DATA_ENCRYPTION_KEY is too short", async () => {
        vi.doMock("~/env", () => ({
            env: { DATA_ENCRYPTION_KEY: "abc123" },
        }));
        await expect(() => import("./encryption")).rejects.toThrow(
            "DATA_ENCRYPTION_KEY must be exactly 64 hex characters",
        );
    });

    it("throws when DATA_ENCRYPTION_KEY contains non-hex characters", async () => {
        vi.doMock("~/env", () => ({
            env: { DATA_ENCRYPTION_KEY: "z".repeat(64) }, // 'z' is not valid hex
        }));
        await expect(() => import("./encryption")).rejects.toThrow(
            "DATA_ENCRYPTION_KEY must be exactly 64 hex characters",
        );
    });

    it("throws when DATA_ENCRYPTION_KEY is empty", async () => {
        vi.doMock("~/env", () => ({
            env: { DATA_ENCRYPTION_KEY: "" },
        }));
        await expect(() => import("./encryption")).rejects.toThrow(
            "DATA_ENCRYPTION_KEY must be exactly 64 hex characters",
        );
    });

    it("accepts a valid 64-char lowercase hex key", async () => {
        vi.doMock("~/env", () => ({
            env: { DATA_ENCRYPTION_KEY: "f".repeat(64) },
        }));
        await expect(import("./encryption")).resolves.toBeDefined();
    });

    it("accepts a valid 64-char uppercase hex key", async () => {
        vi.doMock("~/env", () => ({
            env: { DATA_ENCRYPTION_KEY: "F".repeat(64) },
        }));
        await expect(import("./encryption")).resolves.toBeDefined();
    });
});
