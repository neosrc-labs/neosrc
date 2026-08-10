import { and, desc, eq } from "drizzle-orm";
import { flattenError, z } from "zod";
import { env } from "~/env";
import {
    checkReportPermission,
    KEY_PREFIX,
    verifyApiKey,
} from "~/server/api-keys";
import { verifyGitHubOIDCToken } from "~/server/auth/github-oidc";
import { db } from "~/server/db";
import { pullRequestReport } from "~/server/db/schema";

// Mirrors the column lengths of pullRequestReport (src/server/db/schema.ts) so
// oversized values fail validation with a 400 instead of a Postgres 500.
const MAX_REPOSITORY_LENGTH = 255;
const MAX_NAME_LENGTH = 255;
const MAX_TITLE_LENGTH = 255;
const MAX_COMMIT_SHA_LENGTH = 40;
const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_DESCRIPTION_LENGTH = 100_000;
const MAX_DATA_LENGTH = 1_000_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
// Bounded retries when concurrent uploads of the same report name race on the
// composite primary key (CI matrix jobs hit this).
const MAX_REVISION_RETRIES = 3;
// Note: MAX_DATA_LENGTH is measured in chars while MAX_BODY_BYTES is measured
// in UTF-8 bytes, so multi-byte data below the char cap can be rejected by the
// byte cap. That over-rejection is intentional: bytes are what get transferred
// and stored.
const utf8Decoder = new TextDecoder();

const reportSchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string().max(MAX_REPOSITORY_LENGTH),
    prNumber: z.number(),
    name: z.string().max(MAX_NAME_LENGTH),
    title: z.string().max(MAX_TITLE_LENGTH),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
    commitSha: z.string().max(MAX_COMMIT_SHA_LENGTH).optional(),
    type: z.enum(["markdown"]),
    data: z.string().min(1).max(MAX_DATA_LENGTH),
    sourceUrl: z.string().max(MAX_SOURCE_URL_LENGTH).optional(),
});

const identifySchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string().max(MAX_REPOSITORY_LENGTH),
    prNumber: z.number(),
    name: z.string().max(MAX_NAME_LENGTH),
});

const stateSchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string().max(MAX_REPOSITORY_LENGTH),
    prNumber: z.number(),
    name: z.string().max(MAX_NAME_LENGTH),
    state: z.enum(["VALID", "OUTDATED"]),
});

type ReportRow = typeof pullRequestReport.$inferSelect;
type ReportInsert = typeof pullRequestReport.$inferInsert;

function tooLargeResponse(): Response {
    return Response.json(
        {
            error: `Request body too large (max ${MAX_BODY_BYTES} bytes)`,
        },
        { status: 413 },
    );
}

/**
 * Reads the request body with a hard byte budget. Content-Length alone cannot
 * be trusted: chunked/HTTP2 requests omit it, so the actual bytes are counted
 * while streaming (which also bounds memory for oversized bodies).
 */
async function readBody(
    request: Request,
): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
        const bytes = Number(contentLength);
        if (Number.isFinite(bytes) && bytes > MAX_BODY_BYTES) {
            return { ok: false, response: tooLargeResponse() };
        }
    }

    if (!request.body) return { ok: true, text: "" };

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            total += value.byteLength;
            if (total > MAX_BODY_BYTES) {
                await reader.cancel();
                return { ok: false, response: tooLargeResponse() };
            }
            chunks.push(value);
        }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, text: utf8Decoder.decode(merged) };
}

async function authenticateRequest(
    request: Request,
    provider: "github" | "codeberg",
    repository: string,
): Promise<Response | null> {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (token?.startsWith(KEY_PREFIX)) {
        const verified = await verifyApiKey(token);
        if (!verified) {
            return Response.json(
                { error: "Invalid or expired API key" },
                { status: 401 },
            );
        }
        if (
            !checkReportPermission(verified.permissions, provider, repository)
        ) {
            return Response.json(
                {
                    error: `API key does not have permission for ${repository}`,
                },
                { status: 403 },
            );
        }
        return null;
    }

    // Unauthenticated writes are only possible in development when explicitly
    // opted in via ALLOW_UNAUTHENTICATED_REPORTS="true". Never in production.
    const unauthenticatedAllowed =
        env.NODE_ENV === "development" &&
        env.ALLOW_UNAUTHENTICATED_REPORTS === "true";

    if (provider === "github") {
        if (!token) {
            if (!unauthenticatedAllowed) {
                return Response.json(
                    { error: "Missing bearer token" },
                    { status: 401 },
                );
            }
            return null;
        }
        try {
            const claims = await verifyGitHubOIDCToken(token);
            if (claims.repository !== repository) {
                return Response.json(
                    {
                        error: `Token repository mismatch: ${claims.repository} vs ${repository}`,
                    },
                    { status: 403 },
                );
            }
            return null;
        } catch {
            return Response.json({ error: "Invalid token" }, { status: 401 });
        }
    }

    // Codeberg reports are only accepted with a valid API key (checked above)
    // unless the development bypass is explicitly enabled.
    if (!unauthenticatedAllowed) {
        return Response.json(
            { error: "Missing bearer token" },
            { status: 401 },
        );
    }
    return null;
}

async function getLatestRow(
    provider: string,
    repository: string,
    prNumber: number,
    name: string,
) {
    const [latest] = await db
        .select()
        .from(pullRequestReport)
        .where(
            and(
                eq(pullRequestReport.provider, provider),
                eq(pullRequestReport.repositorySlug, repository),
                eq(pullRequestReport.prNumber, prNumber),
                eq(pullRequestReport.name, name),
            ),
        )
        .orderBy(desc(pullRequestReport.revision))
        .limit(1);
    return latest ?? null;
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    );
}

/**
 * Inserts a new revision of a report, re-reading the latest revision and
 * retrying when a concurrent request won the race for the composite primary
 * key (provider, repositorySlug, prNumber, name, revision). Returns "conflict"
 * when retries are exhausted.
 */
async function insertReportRevision(
    provider: string,
    repository: string,
    prNumber: number,
    name: string,
    buildValues: (latest: ReportRow | null, revision: number) => ReportInsert,
): Promise<"inserted" | "conflict"> {
    for (let attempt = 0; attempt < MAX_REVISION_RETRIES; attempt++) {
        const latest = await getLatestRow(provider, repository, prNumber, name);
        const revision = (latest?.revision ?? 0) + 1;
        try {
            await db
                .insert(pullRequestReport)
                .values(buildValues(latest, revision));
            return "inserted";
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
    }
    return "conflict";
}

export async function PUT(request: Request) {
    const body = await readBody(request);
    if (!body.ok) return body.response;

    let json: unknown;
    try {
        json = JSON.parse(body.text);
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = reportSchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: flattenError(result.error).fieldErrors,
            },
            { status: 400 },
        );
    }

    const parsed = result.data;

    const authError = await authenticateRequest(
        request,
        parsed.provider,
        parsed.repository,
    );
    if (authError) return authError;

    const outcome = await insertReportRevision(
        parsed.provider,
        parsed.repository,
        parsed.prNumber,
        parsed.name,
        (_latest, revision) => ({
            provider: parsed.provider,
            repositorySlug: parsed.repository,
            prNumber: parsed.prNumber,
            revision,
            name: parsed.name,
            title: parsed.title,
            description: parsed.description,
            commitSha: parsed.commitSha,
            sourceUrl: parsed.sourceUrl,
            type: parsed.type,
            data: parsed.data,
        }),
    );
    if (outcome === "conflict") {
        return Response.json(
            {
                error: "Concurrent report upload; retry the request",
            },
            { status: 409 },
        );
    }

    return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
    });
}

export async function POST(request: Request) {
    const body = await readBody(request);
    if (!body.ok) return body.response;

    let json: unknown;
    try {
        json = JSON.parse(body.text);
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = stateSchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: flattenError(result.error).fieldErrors,
            },
            { status: 400 },
        );
    }

    const parsed = result.data;

    const authError = await authenticateRequest(
        request,
        parsed.provider,
        parsed.repository,
    );
    if (authError) return authError;

    const latest = await getLatestRow(
        parsed.provider,
        parsed.repository,
        parsed.prNumber,
        parsed.name,
    );
    if (!latest) {
        return Response.json({ error: "Report not found" }, { status: 404 });
    }

    await db
        .update(pullRequestReport)
        .set({ state: parsed.state })
        .where(
            and(
                eq(pullRequestReport.provider, latest.provider),
                eq(pullRequestReport.repositorySlug, latest.repositorySlug),
                eq(pullRequestReport.prNumber, latest.prNumber),
                eq(pullRequestReport.name, latest.name),
                eq(pullRequestReport.revision, latest.revision),
            ),
        );

    return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
    });
}

export async function DELETE(request: Request) {
    const body = await readBody(request);
    if (!body.ok) return body.response;

    let json: unknown;
    try {
        json = JSON.parse(body.text);
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = identifySchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: flattenError(result.error).fieldErrors,
            },
            { status: 400 },
        );
    }

    const parsed = result.data;

    const authError = await authenticateRequest(
        request,
        parsed.provider,
        parsed.repository,
    );
    if (authError) return authError;

    const latest = await getLatestRow(
        parsed.provider,
        parsed.repository,
        parsed.prNumber,
        parsed.name,
    );
    if (!latest) {
        return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const outcome = await insertReportRevision(
        parsed.provider,
        parsed.repository,
        parsed.prNumber,
        parsed.name,
        (latestRow, revision) => ({
            provider: parsed.provider,
            repositorySlug: parsed.repository,
            prNumber: parsed.prNumber,
            revision,
            name: parsed.name,
            title: latestRow?.title ?? latest.title,
            state: "REMOVED",
            type: "tombstone",
        }),
    );
    if (outcome === "conflict") {
        return Response.json(
            {
                error: "Concurrent report update; retry the request",
            },
            { status: 409 },
        );
    }

    return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
    });
}
