import { headers } from "next/headers";
import { auth } from "~/server/auth";

export async function GET() {
    const response = await auth.api.signInSocial({
        body: {
            provider: "github",
            callbackURL: "/",
        },
        headers: await headers(),
        asResponse: true,
    });

    const { url } = await response.json();

    const redirect = new Response(null, { status: 302 });
    redirect.headers.set("Location", url);

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
        redirect.headers.set("Set-Cookie", setCookie);
    }

    return redirect;
}
