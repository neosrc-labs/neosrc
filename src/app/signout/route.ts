import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export async function GET() {
    const requestHeaders = await headers();
    await auth.api.signOut({
        headers: requestHeaders,
    });
    redirect("/");
}
