import { resolveRawFileRequest } from "../_lib/raw-file";

export async function GET(request: Request) {
    const resolved = await resolveRawFileRequest(request);
    if (!resolved.ok) return resolved.response;
    const { owner, repo, sha, path } = resolved.params;

    const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`,
        {
            headers: {
                Authorization: `Bearer ${resolved.accessToken}`,
            },
            signal: request.signal,
        },
    );

    if (!response.ok) {
        return new Response("Failed to fetch file", {
            status: response.status,
        });
    }

    const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
    const body = await response.arrayBuffer();

    return new Response(body, {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=31536000, immutable",
        },
    });
}
