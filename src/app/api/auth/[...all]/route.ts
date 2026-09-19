import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { AUTH_SESSION_FRESH_AGE_SECONDS, auth } from "~/server/auth";

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth.handler);
const LINK_ACCOUNT_PATHS = [
    "/api/auth/link-social",
    "/api/auth/oauth2/link",
] as const;

export async function GET(request: Request) {
    const url = new URL(request.url);

    // GitHub App installs with "request user authorization during
    // installation" bounce the browser through the OAuth callback with
    // setup_action=install and no better-auth state. The installation automatically
    // grants new permissions to the existing token.
    if (
        url.pathname.endsWith("/callback/github") &&
        url.searchParams.get("setup_action") === "install"
    ) {
        return NextResponse.redirect(new URL("/onboarding", url));
    }

    return authGET(request);
}

export async function POST(request: Request) {
    const url = new URL(request.url);
    if (LINK_ACCOUNT_PATHS.some((path) => url.pathname.endsWith(path))) {
        const session = await auth.api.getSession({ headers: request.headers });
        const createdAt = session
            ? new Date(session.session.createdAt).getTime()
            : 0;
        const freshForMs = AUTH_SESSION_FRESH_AGE_SECONDS * 1000;
        if (!createdAt || Date.now() - createdAt >= freshForMs) {
            return NextResponse.json(
                {
                    code: "SESSION_NOT_FRESH",
                    message:
                        "Recent sign-in required. Sign out and sign in again before linking an account.",
                },
                { status: 403 },
            );
        }
    }

    return authPOST(request);
}
