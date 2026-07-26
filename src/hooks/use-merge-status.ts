"use client";

import { useMemo } from "react";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";

export interface MergeStatus {
    approvalCount: number;
    changesRequestedCount: number;
    pendingReviewerCount: number;
    requiredApprovalCount: number;
    requiredChecks: string[];
    isLoading: boolean;
}

export function useMergeStatus({
    owner,
    repo,
    number,
    pullRequest,
}: {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
}): MergeStatus {
    const { data: reviews, isLoading: reviewsLoading } =
        api.pulls.listReviews.useQuery(
            { owner, repo, number },
            { staleTime: 30_000 },
        );

    const { data: mergeReqs, isLoading: mergeReqsLoading } =
        api.pulls.getMergeRequirements.useQuery(
            { owner, repo, number },
            { staleTime: 60_000 },
        );

    return useMemo(() => {
        const reviewStateMap = new Map<string, string>();
        const authorLogin = pullRequest.user?.login;

        if (reviews) {
            for (const review of reviews) {
                if (!review.user) continue;
                if (review.user.login === authorLogin) continue;
                const state = review.state;
                if (state === "APPROVED" || state === "CHANGES_REQUESTED") {
                    reviewStateMap.set(review.user.login, state);
                } else if (state === "DISMISSED") {
                    reviewStateMap.delete(review.user.login);
                } else if (
                    state === "COMMENTED" &&
                    !reviewStateMap.has(review.user.login)
                ) {
                    reviewStateMap.set(review.user.login, "COMMENTED");
                }
            }
        }

        const requestedReviewerLogins = new Set(
            (pullRequest.requested_reviewers ?? []).map((r) => r.login),
        );

        for (const login of requestedReviewerLogins) {
            if (reviewStateMap.get(login) === "COMMENTED") {
                reviewStateMap.set(login, "PENDING");
            }
        }

        const reviewStates = [...reviewStateMap.values()];
        const approvalCount = reviewStates.filter(
            (s) => s === "APPROVED",
        ).length;
        const changesRequestedCount = reviewStates.filter(
            (s) => s === "CHANGES_REQUESTED",
        ).length;
        const pendingCount = [...requestedReviewerLogins].filter(
            (login) => !reviewStateMap.has(login),
        ).length;

        return {
            approvalCount,
            changesRequestedCount,
            pendingReviewerCount: pendingCount,
            requiredApprovalCount: mergeReqs?.requiredApprovingReviewCount ?? 0,
            requiredChecks: mergeReqs?.requiredChecks ?? [],
            isLoading: reviewsLoading || mergeReqsLoading,
        };
    }, [
        reviews,
        pullRequest.user?.login,
        pullRequest.requested_reviewers,
        mergeReqs,
        reviewsLoading,
        mergeReqsLoading,
    ]);
}
