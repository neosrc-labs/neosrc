"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";

interface DisableAutoMergeButtonProps {
    owner: string;
    repo: string;
    number: number;
}

export function DisableAutoMergeButton({
    owner,
    repo,
    number,
}: DisableAutoMergeButtonProps) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const disableMutation = api.pulls.disableAutoMerge.useMutation({
        onSuccess: () => {
            setError(null);
            router.refresh();
        },
        onError: (err) => setError(err.message),
    });

    return (
        <div className="flex items-center gap-2">
            <button
                suppressHydrationWarning
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-1.5 py-2.5 text-text-secondary text-xs transition-colors hover:bg-surface-tertiary sm:px-3 dark:border-zinc-600"
                disabled={disableMutation.isPending}
                onClick={() => disableMutation.mutate({ owner, repo, number })}
                type="button"
            >
                <X size={14} />
                {disableMutation.isPending
                    ? "Disabling..."
                    : "Disable auto-merge"}
            </button>
            {error && <span className="text-red-600 text-xs">{error}</span>}
            {disableMutation.isError && !error && (
                <span className="text-red-600 text-xs">
                    Failed to disable. Please try again.
                </span>
            )}
        </div>
    );
}
