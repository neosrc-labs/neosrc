import { createHmac, timingSafeEqual } from "node:crypto";
import type {
    IssuesEvent,
    MemberEvent,
    PullRequestEvent,
    WebhookEvent,
} from "@octokit/webhooks-types";
import { and, eq } from "drizzle-orm";
import { env } from "~/env";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import { deleteRepoIssuePullCountsCache } from "~/server/cache";
import { db } from "~/server/db";
import { betterAuthAccount } from "~/server/db/schema";
import { syncCurrentUser } from "~/server/sync";

const SIGNATURE_PREFIX = "sha256=";
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
    const validation = await validateWebhookAuth(request);
    if (validation.outcome === "ERROR") {
        return validation.error;
    }

    let body: WebhookEvent;
    try {
        const { body: raw } = validation;
        body = JSON.parse(raw) as WebhookEvent;
    } catch {
        return new Response("body not valid JSON", { status: 400 });
    }

    const { event } = parseGitHubHeaders(request);

    await handleWebhookEvent(event, body);

    return new Response("ok", { headers: { "Content-Type": "text/plain" } });
}

async function handleWebhookEvent(
    event: string | null,
    body: WebhookEvent,
): Promise<void> {
    if (isOpenStateChange(event, body)) {
        const [owner, repo] = body.repository.full_name.split("/");
        if (!owner || !repo) return;
        await deleteRepoIssuePullCountsCache("gh", owner, repo);
    }

    if (isMemberEvent(event, body)) {
        await forceSyncMember(body);
    }
}

function isMemberEvent(
    event: string | null,
    body: WebhookEvent,
): body is MemberEvent {
    return event === "member" && "member" in body;
}

/**
 * A `member` event fires when a collaborator is added, removed, or re-granted
 * on a repository, so that user's effective permissions just changed. Force a
 * full re-sync for them so the permission view is current immediately instead
 * of waiting for the next poll. Best-effort: a failing sync only logs, the
 * poll path retries anyway and the webhook must not reject the delivery.
 */
async function forceSyncMember(body: MemberEvent): Promise<void> {
    const [account] = await db
        .select({ userId: betterAuthAccount.userId })
        .from(betterAuthAccount)
        .where(
            and(
                eq(betterAuthAccount.providerId, "github"),
                eq(betterAuthAccount.accountId, String(body.member.id)),
            ),
        )
        .limit(1);
    if (!account) return;

    try {
        const accessToken = await getGitHubToken(db, account.userId);
        if (isAnonymousToken(accessToken)) return;
        await syncCurrentUser(db, {
            provider: "github",
            accessToken,
            userId: account.userId,
            forceFull: true,
        });
    } catch (error) {
        console.warn(
            `[github-webhook] member sync failed for user ${account.userId}:`,
            error,
        );
    }
}

function isOpenStateChange(
    event: string | null,
    body: WebhookEvent,
): body is IssuesEvent | PullRequestEvent {
    if (event !== "issues" && event !== "pull_request") return false;
    if (!("action" in body)) return false;
    return (
        body.action === "opened" ||
        body.action === "closed" ||
        body.action === "reopened"
    );
}

function tooLargeResponse(): Response {
    return Response.json(
        { error: `Request body too large (max ${MAX_BODY_BYTES} bytes)` },
        { status: 413 },
    );
}

/**
 * GitHub signs webhook payloads with an HMAC-SHA256 of the raw body keyed by
 * the webhook secret, sent as `sha256=<hex digest>` in the
 * `x-hub-signature-256` header. The comparison must be constant-time so the
 * response timing does not leak digest prefixes.
 */
function signatureMatches(signature: string, expected: string): boolean {
    const signatureBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (signatureBytes.length !== expectedBytes.length) return false;
    return timingSafeEqual(signatureBytes, expectedBytes);
}

/**
 * Reads the request body with a hard byte budget. The signature covers the raw
 * body, so the whole payload must be buffered before it can be verified; the
 * budget stops an unauthenticated caller from exhausting memory. Content-Length
 * alone cannot be trusted: chunked/HTTP2 requests omit it.
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
    const decoder = new TextDecoder();
    let text = "";
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            total += value.byteLength;
            if (total > MAX_BODY_BYTES) {
                await reader.cancel();
                return { ok: false, response: tooLargeResponse() };
            }
            text += decoder.decode(value, { stream: true });
        }
    }
    text += decoder.decode();
    return { ok: true, text };
}

type Validation =
    | { outcome: "ERROR"; error: Response }
    | { outcome: "SUCCESS"; body: string };

async function validateWebhookAuth(request: Request): Promise<Validation> {
    const { signature, event, delivery } = parseGitHubHeaders(request);

    if (!signature) {
        console.warn(
            `[github-webhook] rejected ${event} (${delivery}): missing signature`,
        );
        return {
            outcome: "ERROR",
            error: new Response("missing signature", { status: 401 }),
        };
    }

    const body = await readBody(request);
    if (!body.ok) {
        return {
            outcome: "ERROR",
            error: new Response("missing body", { status: 401 }),
        };
    }

    const expected = `${SIGNATURE_PREFIX}${createHmac(
        "sha256",
        env.GITHUB_WEBHOOK_SECRET,
    )
        .update(body.text)
        .digest("hex")}`;

    if (!signatureMatches(signature, expected)) {
        console.warn(
            `[github-webhook] rejected ${event} (${delivery}): invalid signature`,
        );
        return {
            outcome: "ERROR",
            error: new Response("invalid signature", { status: 401 }),
        };
    }

    return {
        outcome: "SUCCESS",
        body: body.text,
    };
}

function parseGitHubHeaders(request: Request) {
    return {
        signature: request.headers.get("x-hub-signature-256"),
        event: request.headers.get("x-github-event"),
        delivery: request.headers.get("x-github-delivery"),
    };
}
