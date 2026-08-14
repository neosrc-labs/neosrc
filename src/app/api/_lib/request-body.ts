import { flattenError, type ZodType } from "zod";

export function tooLargeResponse(maxBytes: number): Response {
    return Response.json(
        {
            error: `Request body too large (max ${maxBytes} bytes)`,
        },
        { status: 413 },
    );
}

/**
 * Reads the request body with a hard byte budget. Content-Length alone cannot
 * be trusted: chunked/HTTP2 requests omit it, so the actual bytes are counted
 * while streaming (which also bounds memory for oversized bodies).
 */
export async function readBody(
    request: Request,
    maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
        const bytes = Number(contentLength);
        if (Number.isFinite(bytes) && bytes > maxBytes) {
            return { ok: false, response: tooLargeResponse(maxBytes) };
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
            if (total > maxBytes) {
                await reader.cancel();
                return { ok: false, response: tooLargeResponse(maxBytes) };
            }
            text += decoder.decode(value, { stream: true });
        }
    }
    text += decoder.decode();
    return { ok: true, text };
}

/**
 * Reads and validates a JSON request body against a zod schema, returning
 * either the parsed data or an error response (413 for oversized bodies, 400
 * for invalid JSON or validation failures).
 */
export async function parseJsonBody<T>(
    request: Request,
    schema: ZodType<T>,
    maxBytes: number,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
    const body = await readBody(request, maxBytes);
    if (!body.ok) return { ok: false, response: body.response };

    let json: unknown;
    try {
        json = JSON.parse(body.text);
    } catch {
        return {
            ok: false,
            response: Response.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            ),
        };
    }

    const result = schema.safeParse(json);
    if (!result.success) {
        return {
            ok: false,
            response: Response.json(
                {
                    error: "Validation failed",
                    issues: flattenError(result.error).fieldErrors,
                },
                { status: 400 },
            ),
        };
    }
    return { ok: true, data: result.data };
}
