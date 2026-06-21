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
});

export async function POST(request: Request) {
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
    console.log("Got report", parsed);

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
            !checkReportPermission(
                verified.permissions,
                parsed.provider,
                parsed.repository,
            )
        ) {
            return Response.json(
                {
                    error: `API key does not have permission to upload to ${parsed.repository}`,
                },
                { status: 403 },
            );
        }
    } else if (parsed.provider === "github") {
        if (!token) {
            if (process.env.NODE_ENV !== "development") {
                return Response.json(
                    { error: "Missing bearer token" },
                    { status: 401 },
                );
            }
        } else {
            try {
                const claims = await verifyGitHubOIDCToken(token);
                if (claims.repository !== parsed.repository) {
                    return Response.json(
                        {
                            error: `Repository mismatch: token is for ${claims.repository}, payload is for ${parsed.repository}`,
                        },
                        { status: 403 },
                    );
                }
            } catch {
                return Response.json(
                    { error: "Invalid token" },
                    { status: 401 },
                );
            }
        }
    }

    const [latestRevision] = await db
        .select({ revision: pullRequestReport.revision })
        .from(pullRequestReport)
        .where(
            and(
                eq(pullRequestReport.provider, parsed.provider),
                eq(pullRequestReport.repositorySlug, parsed.repository),
                eq(pullRequestReport.prNumber, parsed.prNumber),
                eq(pullRequestReport.name, parsed.name),
            ),
        )
        .orderBy(desc(pullRequestReport.revision))
        .limit(1);

    const revision = (latestRevision?.revision ?? 0) + 1;

    await db.insert(pullRequestReport).values({
        provider: parsed.provider,
        repositorySlug: parsed.repository,
        prNumber: parsed.prNumber,
        revision,
        name: parsed.name,
        title: parsed.title,
        description: parsed.description,
        commitSha: parsed.commitSha,
        type: parsed.type,
        data: parsed.data,
    });

    return new Response("ok", {
        headers: {
            "Content-Type": "text/plain",
        },
    });
}
