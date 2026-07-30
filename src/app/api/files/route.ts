import { getSession, githubAccessToken } from "~/server/auth";
import { getPullRequestFilesStream } from "~/server/github";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const numberParam = searchParams.get("number");
    const commitSha = searchParams.get("commitSha") ?? undefined;

    if (!owner || !repo || !numberParam) {
        return new Response(null, { status: 400 });
    }

    const number = parseInt(numberParam, 10);
    if (!Number.isFinite(number) || number < 1) {
        return new Response(null, { status: 400 });
    }

    const accessToken = await githubAccessToken();
    if (!accessToken) {
        return new Response(null, { status: 401 });
    }

    const session = await getSession();
    const userId = session?.user?.id;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            for await (const page of getPullRequestFilesStream(
                accessToken,
                owner,
                repo,
                number,
                commitSha,
                userId ?? undefined,
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
