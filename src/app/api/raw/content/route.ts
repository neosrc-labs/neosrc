import { Octokit } from "@octokit/rest";
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

    const octokit = new Octokit({ auth: accessToken });

    try {
        const response = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: sha,
        });

        const data = response.data;
        if (Array.isArray(data) || !("content" in data)) {
            return new Response("Expected a file, got a directory", {
                status: 400,
            });
        }

        const content = Buffer.from(data.content, "base64").toString("utf-8");

        return new Response(content, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (_error) {
        return new Response("Failed to fetch file content", { status: 500 });
    }
}
