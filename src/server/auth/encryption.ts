import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "~/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, recommended for GCM
const KEY_LENGTH = 32; // 256-bit key
const TAG_LENGTH = 16; // 128-bit auth tag (GCM default)

const KEY: Buffer | null = (() => {
    const raw = env.DATA_ENCRYPTION_KEY;

    // undefined means the env var is not configured at all (e.g. during CI
    // builds where encryption is never invoked). Return null so the module
    // loads without crashing; calls to encrypt/decrypt will throw via
    // requireKey() below.
    if (raw === undefined) return null;

    if (!/^[0-9a-f]{64}$/i.test(raw)) {
        throw new Error(
            "DATA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
                `Got ${raw.length} characters.`,
        );
    }

    const key = Buffer.from(raw, "hex");

    if (key.length !== KEY_LENGTH) {
        throw new Error(
            `Invalid encryption key length: expected ${KEY_LENGTH} bytes, got ${key.length}.`,
        );
    }

    return key;
})();

function requireKey(): Buffer {
    if (!KEY) throw new Error("DATA_ENCRYPTION_KEY is not set");
    return KEY;
}

/**
 * Encrypts a UTF-8 string using AES-256-GCM.
 *
 * Output format (base64url, single string):
 *   base64url( [12-byte IV] [16-byte auth tag] [N-byte ciphertext] )
 *
 * Using a fixed-offset binary layout eliminates ambiguity from delimiter-based
 * formats, which can break if the encoded values contain the delimiter character.
 */
export function encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, requireKey(), iv);

    const ciphertext = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag(); // always 16 bytes for GCM

    // Pack into a single buffer: IV | authTag | ciphertext
    const packed = Buffer.concat([iv, authTag, ciphertext]);
    return packed.toString("base64url");
}

/**
 * Decrypts a string produced by `encrypt`.
 *
 * @throws {Error} If the input is malformed, tampered with, or otherwise
 *   cannot be decrypted. Callers must handle this error explicitly.
 */
export function decrypt(encrypted: string): string {
    let packed: Buffer;

    try {
        packed = Buffer.from(encrypted, "base64url");
    } catch (err) {
        throw new Error("Decryption failed: input is not valid base64url", {
            cause: err,
        });
    }

    const minLength = IV_LENGTH + TAG_LENGTH;
    if (packed.length < minLength) {
        throw new Error(
            `Decryption failed: input too short (${packed.length} bytes, minimum ${minLength})`,
        );
    }

    // Unpack fixed-length fields from the front of the buffer
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    try {
        const decipher = createDecipheriv(ALGORITHM, requireKey(), iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);

        return decrypted.toString("utf8");
    } catch (err) {
        // Re-throw with a stable message so callers can match on it, but
        // preserve the underlying cause for debugging.
        throw new Error(
            "Decryption failed: authentication tag mismatch or corrupted data",
            {
                cause: err,
            },
        );
    }
}
