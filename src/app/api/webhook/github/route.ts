import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "~/env";

const SIGNATURE_PREFIX = "sha256=";
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
    const validation = await validateWebhookAuth(request);
    if (validation.outcome === "ERROR") {
        return validation.error;
    }

    let body = null;
    try {
        const { body: raw } = validation;
        body = JSON.parse(raw);
    } catch {
        return new Response("body not valid JSON", { status: 400 });
    }

    const { event, delivery } = parseGitHubHeaders(request);

    console.log(`[github-webhook] ${event} (${delivery})`, body);

    return new Response("ok", { headers: { "Content-Type": "text/plain" } });
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
