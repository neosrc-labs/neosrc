"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error boundary convention
export default function Error({
    error: _error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <AlertTriangle className="size-12 text-text-muted" />
            <h1 className="font-semibold text-text-primary text-xl">
                500 - Something went wrong
            </h1>
            <p className="max-w-sm text-sm text-text-tertiary">
                An unexpected error occurred. Please try again.
            </p>
            <button
                type="button"
                onClick={() => {
                    reset();
                    router.refresh();
                }}
                className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-black dark:hover:bg-neutral-200"
            >
                Try again
            </button>
        </div>
    );
}
