import { githubAccessToken } from "~/server/auth";
import {
    getAuthenticatedUser,
    getPullRequestFilesStream,
} from "~/server/github";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const number = searchParams.get("number");
    const commitSha = searchParams.get("commitSha") ?? undefined;

    if (!owner || !repo || !number) {
        return new Response(null, { status: 400 });
    }

    const accessToken = await githubAccessToken();
    if (!accessToken) {
        return new Response(null, { status: 401 });
    }

    let username: string | undefined;
    try {
        username = (await getAuthenticatedUser(accessToken)).login;
    } catch {
        // Not authenticated — proceed without username (no cache)
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            for await (const page of getPullRequestFilesStream(
                accessToken,
                owner,
                repo,
                parseInt(number, 10),
                commitSha,
                username,
            )) {
                controller.enqueue(encoder.encode(`${JSON.stringify(page)}\n`));
            }
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
