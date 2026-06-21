import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { apiKey, apiKeyPermission } from "~/server/db/schema";

const KEY_PREFIX = "neo_";
const KEY_BYTES = 32;

function bufToHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function generateApiKey(): Promise<{
    rawKey: string;
    hash: string;
}> {
    const random = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    const rawKey = KEY_PREFIX + bufToHex(random.buffer);
    const hash = bufToHex(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey)),
    );
    return { rawKey, hash };
}

export async function verifyApiKey(rawKey: string): Promise<{
    key: typeof apiKey.$inferSelect;
    permissions: (typeof apiKeyPermission.$inferSelect)[];
} | null> {
    if (!rawKey.startsWith(KEY_PREFIX)) return null;

    const hash = bufToHex(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey)),
    );

    const [key] = await db
        .select()
        .from(apiKey)
        .where(
            and(
                eq(apiKey.hash, hash),
                or(
                    isNull(apiKey.expirationTimestamp),
                    sql`${apiKey.expirationTimestamp} > NOW()`,
                ),
            ),
        )
        .limit(1);

    if (!key) return null;

    const permissions = await db
        .select()
        .from(apiKeyPermission)
        .where(eq(apiKeyPermission.apiKeyId, key.id));

    return { key, permissions };
}

export function checkReportPermission(
    permissions: (typeof apiKeyPermission.$inferSelect)[],
    provider: string,
    repository: string,
): boolean {
    const owner = repository.split("/")[0];
    if (!owner) return false;

    const prefixedOwner = `${provider}:${owner}`;
    const prefixedRepo = `${provider}:${repository}`;

    return permissions.some((p) => {
        if (p.kind === "UPLOAD_REPORT_OWNER") {
            return p.target === prefixedOwner;
        }
        if (p.kind === "UPLOAD_REPORT_REPO") {
            return p.target === prefixedRepo;
        }
        return false;
    });
}
