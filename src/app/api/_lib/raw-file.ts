import { githubAccessToken } from "~/server/auth";

export interface RawFileParams {
    owner: string;
    repo: string;
    sha: string;
    path: string;
}

/**
 * Parses the owner/repo/sha/path query params for the raw-file endpoints and
 * resolves the GitHub access token, returning an error response for missing
 * params or an unauthenticated caller.
 */
export async function resolveRawFileRequest(
    request: Request,
): Promise<
    | { ok: true; params: RawFileParams; accessToken: string }
    | { ok: false; response: Response }
> {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const sha = searchParams.get("sha");
    const path = searchParams.get("path");

    if (!owner || !repo || !sha || !path) {
        return {
            ok: false,
            response: new Response("Missing required parameters", {
                status: 400,
            }),
        };
    }

    const accessToken = await githubAccessToken();
    if (!accessToken) {
        return { ok: false, response: new Response(null, { status: 401 }) };
    }

    return { ok: true, params: { owner, repo, sha, path }, accessToken };
}
