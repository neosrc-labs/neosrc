"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { api } from "~/trpc/react";

export function ReadyForReviewButton({
    owner,
    repo,
    number,
    setMarkedReady,
}: {
    owner: string;
    repo: string;
    number: number;
    setMarkedReady: (v: boolean) => void;
}) {
    const router = useRouter();
    const utils = api.useUtils();
    const markReadyMutation = api.pulls.markReadyForReview.useMutation({
        onSuccess: () => {
            setMarkedReady(true);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const handleMarkReady = useCallback(() => {
        markReadyMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, markReadyMutation]);

    return (
        <button
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-gray-200 px-1.5 py-2 font-medium text-gray-800 text-xs transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            disabled={markReadyMutation.isPending}
            onClick={handleMarkReady}
            type="button"
        >
            {markReadyMutation.isPending
                ? "Marking..."
                : "Mark as ready for review"}
        </button>
    );
}
