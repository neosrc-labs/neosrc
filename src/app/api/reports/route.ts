import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
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

    // TODO: Validate authentication

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
