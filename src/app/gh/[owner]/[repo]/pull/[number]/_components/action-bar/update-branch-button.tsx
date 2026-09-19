"use client";

import { ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionError } from "~/components/action-errors";
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

    useActionError("update-branch", updateMutation.error?.message ?? null);

    return (
        <div className="flex items-center gap-2">
            <button
                suppressHydrationWarning
                className="flex cursor-pointer items-center justify-center gap-1.5 text-nowrap rounded-md border border-border px-1.5 py-2.5 text-text-secondary text-xs transition-colors hover:bg-surface-tertiary sm:px-3"
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
        </div>
    );
}
