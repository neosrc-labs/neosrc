import { FileQuestion, LogIn } from "lucide-react";
import { getSession } from "~/server/auth";

export default async function NotFound() {
    const session = await getSession();
    const signedIn = !!session?.user;

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <FileQuestion className="size-12 text-text-muted" />
            <h1 className="font-semibold text-text-primary text-xl">
                404 - Page not found
            </h1>
            <p className="max-w-sm text-sm text-text-tertiary">
                {signedIn
                    ? "The page you are looking for does not exist."
                    : "The page you are looking for does not exist, or you may need to sign in to access it."}
            </p>
            {!signedIn && (
                <a
                    href="/api/auth/signin"
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                    <LogIn className="size-3.5" />
                    Sign in
                </a>
            )}
        </div>
    );
}
