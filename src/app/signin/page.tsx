import { redirect } from "next/navigation";
import { getSession } from "~/server/auth";

export default async function SignInPage() {
    const session = await getSession();
    if (session) redirect("/");

    return (
        <div className="flex h-[calc(100svh-var(--header-height))] items-center justify-center">
            <a
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                href="/signin/github"
            >
                Sign in with GitHub
            </a>
        </div>
    );
}
