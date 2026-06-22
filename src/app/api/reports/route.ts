import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
    checkReportPermission,
    KEY_PREFIX,
    verifyApiKey,
} from "~/server/api-keys";
import { verifyGitHubOIDCToken } from "~/server/auth/github-oidc";
import { db } from "~/server/db";
import { pullRequestReport } from "~/server/db/schema";

const reportSchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string(),
    prNumber: z.number(),
    name: z.string(),
    title: z.string(),
    description: z.string().optional(),
    commitSha: z.string().optional(),
    type: z.enum(["markdown"]),
    data: z.string().min(1),
    sourceUrl: z.string().optional(),
});

const identifySchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string(),
    prNumber: z.number(),
    name: z.string(),
});

const stateSchema = z.object({
    provider: z.enum(["github", "codeberg"]),
    repository: z.string(),
    prNumber: z.number(),
    name: z.string(),
    state: z.enum(["VALID", "OUTDATED"]),
});

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

    if (provider === "github") {
        if (!token) {
            if (process.env.NODE_ENV !== "development") {
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

export async function PUT(request: Request) {
    let json: unknown;
    try {
        json = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = reportSchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: result.error.flatten().fieldErrors,
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
    const revision = (latest?.revision ?? 0) + 1;

    await db.insert(pullRequestReport).values({
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
    });

    return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
    });
}

export async function POST(request: Request) {
    let json: unknown;
    try {
        json = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = stateSchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: result.error.flatten().fieldErrors,
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
    let json: unknown;
    try {
        json = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = identifySchema.safeParse(json);
    if (!result.success) {
        return Response.json(
            {
                error: "Validation failed",
                issues: result.error.flatten().fieldErrors,
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

    await db.insert(pullRequestReport).values({
        provider: parsed.provider,
        repositorySlug: parsed.repository,
        prNumber: parsed.prNumber,
        revision: latest.revision + 1,
        name: parsed.name,
        title: latest.title,
        state: "REMOVED",
        type: "tombstone",
    });

    return new Response("ok", {
        headers: { "Content-Type": "text/plain" },
    });
}
