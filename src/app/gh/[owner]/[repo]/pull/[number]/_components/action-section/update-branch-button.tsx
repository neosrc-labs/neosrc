"use client";

import { ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

interface UpdateBranchButtonProps {
    owner: string;
    repo: string;
    number: number;
    expectedHeadSha: string;
}

export function UpdateBranchButton({
    owner,
    repo,
    number,
    expectedHeadSha,
}: UpdateBranchButtonProps) {
    const router = useRouter();
    const utils = api.useUtils();
    const updateMutation = api.pulls.updateBranch.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            // router.refresh() leaves the client query cache intact, so the
            // stale merge state would keep this button mounted with the old
            // head sha and the next click would 422.
            utils.pulls.getMergeState.invalidate({ owner, repo, number });
            router.refresh();
        },
    });

    return (
        <div className="flex items-center gap-2">
            <button
                suppressHydrationWarning
                className="flex cursor-pointer items-center justify-center gap-1.5 text-nowrap rounded-md border border-gray-300 px-1.5 py-2.5 text-text-secondary text-xs transition-colors hover:bg-surface-tertiary sm:px-3 dark:border-zinc-600"
                disabled={updateMutation.isPending}
                onClick={() =>
                    updateMutation.mutate({
                        owner,
                        repo,
                        number,
                        expectedHeadSha,
                    })
                }
                type="button"
            >
                <ArrowDown size={14} />
                {updateMutation.isPending ? "Updating..." : "Update branch"}
            </button>
            {updateMutation.error && (
                <span className="text-red-600 text-xs">
                    {updateMutation.error.message}
                </span>
            )}
        </div>
    );
}
