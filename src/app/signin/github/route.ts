import { auth } from "~/server/auth";

export async function GET() {
    const { url } = await auth.api.signInSocial({
        body: {
            provider: "github",
            callbackURL: "/",
        },
    });

    return Response.redirect(url ?? "/");
}
