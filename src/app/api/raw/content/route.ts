import { Octokit } from "@octokit/rest";
import { resolveRawFileRequest } from "../../_lib/raw-file";

export async function GET(request: Request) {
    const resolved = await resolveRawFileRequest(request);
    if (!resolved.ok) return resolved.response;
    const { owner, repo, sha, path } = resolved.params;

    const octokit = new Octokit({ auth: resolved.accessToken });

    try {
        const response = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: sha,
            request: { signal: request.signal },
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
                "Cache-Control": "private, max-age=31536000, immutable",
            },
        });
    } catch (err) {
        if (request.signal.aborted) throw err;
        return new Response("Failed to fetch file content", { status: 500 });
    }
}
