import { githubAccessToken } from "~/server/auth";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const sha = searchParams.get("sha");
    const path = searchParams.get("path");

    if (!owner || !repo || !sha || !path) {
        return new Response("Missing required parameters", { status: 400 });
    }

    const accessToken = await githubAccessToken();
    if (!accessToken) {
        return new Response(null, { status: 401 });
    }

    const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
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
