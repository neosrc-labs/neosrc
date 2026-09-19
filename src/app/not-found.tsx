import { FileQuestion, LogIn } from "lucide-react";
import { RedirectToExternal } from "~/components/redirect-to-external";
import { getSession } from "~/server/auth";
import { externalFallbackTarget } from "~/server/extension-fallback";

export default async function NotFound() {
    // Reached through the extension, this page exists on the host; go there
    // instead of showing a Neosrc 404.
    const fallback = await externalFallbackTarget();
    if (fallback) return <RedirectToExternal href={fallback} />;

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
                    className="inline-flex items-center gap-1.5 rounded-md bg-action px-4 py-2 font-medium text-action-foreground text-sm shadow-sm transition-colors hover:bg-action-hover"
                >
                    <LogIn className="size-3.5" />
                    Sign in
                </a>
            )}
        </div>
    );
}
