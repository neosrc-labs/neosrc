import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { parseJsonBody } from "~/app/api/_lib/request-body";
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

async function getLatestReportOr404(parsed: {
    provider: string;
    repository: string;
    prNumber: number;
    name: string;
}): Promise<
    { ok: true; latest: ReportRow } | { ok: false; response: Response }
> {
    const latest = await getLatestRow(
        parsed.provider,
        parsed.repository,
        parsed.prNumber,
        parsed.name,
    );
    if (!latest) {
        return {
            ok: false,
            response: Response.json(
                { error: "Report not found" },
                { status: 404 },
            ),
        };
    }
    return { ok: true, latest };
}

async function parseAndAuthorize<
    T extends { provider: "github" | "codeberg"; repository: string },
>(
    request: Request,
    schema: z.ZodType<T>,
): Promise<{ ok: true; parsed: T } | { ok: false; response: Response }> {
    const json = await parseJsonBody(request, schema, MAX_BODY_BYTES);
    if (!json.ok) return json;

    const authError = await authenticateRequest(
        request,
        json.data.provider,
        json.data.repository,
    );
    if (authError) return { ok: false, response: authError };

    return { ok: true, parsed: json.data };
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
    const auth = await parseAndAuthorize(request, reportSchema);
    if (!auth.ok) return auth.response;
    const parsed = auth.parsed;

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
    const auth = await parseAndAuthorize(request, stateSchema);
    if (!auth.ok) return auth.response;
    const parsed = auth.parsed;

    const latestRes = await getLatestReportOr404(parsed);
    if (!latestRes.ok) return latestRes.response;
    const latest = latestRes.latest;

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
    const auth = await parseAndAuthorize(request, identifySchema);
    if (!auth.ok) return auth.response;
    const parsed = auth.parsed;

    const latestRes = await getLatestReportOr404(parsed);
    if (!latestRes.ok) return latestRes.response;
    const latest = latestRes.latest;

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
