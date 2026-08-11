import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";

const { GET: authGET, POST } = toNextJsHandler(auth.handler);

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

export { POST };
