"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import {
    extractPullRequestState,
    StatusPill,
} from "~/components/ui/status-pill";
import { useLocalStorage } from "~/hooks/use-local-storage";
import type { RepositoryInfo } from "~/server/api/routers/repos";
import type { PendingReview } from "~/server/api/routers/reviews";
import type {
    MergeMethod,
    MergeRequirements,
    PullsGetResponseData,
    ReviewComment2,
} from "~/server/github";
import { api } from "~/trpc/react";
import { EMPTY_ARRAY_PROMISE } from "~/utils/promise";
import type { PullRequestPermissionContext } from "../../permissions-utils";
import { ConflictedFiles } from "../conflicted-files";
import { resolveMergeOptions } from "./merge-options";
import { MergeStatusBar } from "./merge-status-bar";
import { ReadyForReviewButton } from "./ready-for-review-button";
import { RevertButton } from "./revert-button";
import { SubmitReviewButton } from "./submit-review-button";
import { usePullPermissions } from "./use-pull-permissions";

interface ActionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    variant?: "header" | "inline";
    isSticky?: boolean;
    checkRuns?: Array<{
        name: string;
        conclusion: string | null;
        status: string;
        html_url?: string;
        details_url?: string | null;
    }>;
}

export function ActionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    permissionContextPromise,
    variant,
    isSticky,
    checkRuns,
}: ActionSectionProps) {
    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: repoData } = api.repos.getByOwnerAndRepo.useQuery({
        provider: "gh",
        owner,
        repo,
    });

    const { data: reviews, isLoading: reviewsLoading } =
        api.pulls.listReviews.useQuery(
            { owner, repo, number },
            { staleTime: 30_000 },
        );

    const {
        data: mergeReqs,
        isLoading: mergeReqsLoading,
        isError: mergeReqsError,
    } = api.pulls.getMergeRequirements.useQuery(
        { owner, repo, number },
        { staleTime: 60_000 },
    );

    const skeleton = <div className="h-9 w-full" />;
    return (
        <div>
            {pullRequestPromise ? (
                <Async fallback={skeleton} promise={pullRequestPromise}>
                    {(pullRequest) => (
                        <Async
                            fallback={null}
                            promise={
                                conflictedFilesPromise ?? EMPTY_ARRAY_PROMISE
                            }
                        >
                            {(files) => (
                                <Async
                                    fallback={null}
                                    promise={permissionContextPromise}
                                >
                                    {(permissionContext) => (
                                        <Buttons
                                            owner={owner}
                                            repo={repo}
                                            number={number}
                                            pullRequest={pullRequest}
                                            conflictedFiles={files}
                                            permissionContext={
                                                permissionContext
                                            }
                                            repoData={repoData}
                                            reviews={reviews}
                                            mergeReqs={mergeReqs}
                                            mergeReqsError={mergeReqsError}
                                            pendingReview={pendingReview}
                                            variant={variant}
                                            isSticky={isSticky}
                                            checkRuns={checkRuns}
                                            isMergeStatusLoading={
                                                reviewsLoading ||
                                                mergeReqsLoading
                                            }
                                        />
                                    )}
                                </Async>
                            )}
                        </Async>
                    )}
                </Async>
            ) : (
                skeleton
            )}
        </div>
    );
}

function Buttons({
    owner,
    repo,
    number,
    pullRequest,
    conflictedFiles,
    permissionContext,
    repoData,
    reviews,
    pendingReview,
    mergeReqs,
    mergeReqsError,
    variant,
    isSticky,
    checkRuns,
    isMergeStatusLoading,
}: {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
    repoData?: RepositoryInfo;
    reviews?: ReviewComment2[] | null;
    pendingReview?: PendingReview | null;
    mergeReqs?: MergeRequirements | null;
    mergeReqsError: boolean;
    conflictedFiles: string[];
    permissionContext: PullRequestPermissionContext;
    variant?: "header" | "inline";
    isSticky?: boolean;
    checkRuns?: Array<{
        name: string;
        conclusion: string | null;
        status: string;
        html_url?: string;
        details_url?: string | null;
    }>;
    isMergeStatusLoading: boolean;
}) {
    const router = useRouter();
    const utils = api.useUtils();
    const [markedReady, setMarkedReady] = useState(false);
    const [isMerged, setIsMerged] = useState(false);
    const [mergeMode, setMergeMode] = useLocalStorage<MergeMethod>(
        "neosrc-merge-mode",
        "merge",
    );
    const navigateAndScroll = useCallback(() => {
        router.push(`/gh/${owner}/${repo}/pull/${number}?scrollTo=bottom`);
    }, [router, owner, repo, number]);

    const dismissReviewMutation = api.reviews.dismiss.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
            utils.reviewComments.list.invalidate();
        },
    });

    const markAsDraftMutation = api.pulls.markAsDraft.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const closeMutation = api.pulls.close.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const reopenMutation = api.pulls.reopen.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const mergeMutation = api.pulls.merge.useMutation({
        onSuccess: () => {
            setIsMerged(true);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            utils.pulls.getStack.invalidate({ owner, repo, prNumber: number });
            router.refresh();
        },
    });

    const handleCancelReview = useCallback(() => {
        if (!pendingReview) return;
        dismissReviewMutation.mutate({
            owner,
            repo,
            number,
            reviewId: pendingReview.reviewId,
        });
    }, [owner, repo, number, pendingReview, dismissReviewMutation]);

    const pendingCommentsCount = pendingReview?.comments.length ?? 0;
    const isDraft = !!pullRequest.draft && !markedReady;
    const effectiveMerged = pullRequest.merged || isMerged;
    const {
        isAuthor,
        canWrite,
        canManagePR,
        canMerge,
        canInteract,
        isMergeBlocked,
        isMergeStateUnknown,
        isStackMerge,
    } = usePullPermissions(permissionContext, pullRequest);
    const { data: stackData, isLoading: stackLoading } =
        api.pulls.getStack.useQuery(
            { owner, repo, prNumber: number },
            { enabled: !!pullRequest.stack },
        );
    const stackMergeBlocked = stackData
        ? stackData.pullRequests
              .filter(
                  (e) => (e.position ?? 0) < (pullRequest.stack?.position ?? 0),
              )
              .reduce<string | null>((reason, e) => {
                  if (reason) return reason;
                  if (e.mergeable === "CONFLICTING") return "conflicts";
                  if (e.state === "closed" || e.draft) return "closed";
                  return null;
              }, null)
        : null;
    const allMergeOptions = resolveMergeOptions(repoData);
    const availableMergeOptions = allMergeOptions.filter((o) => o.allowed);
    const noMergeMethodsAvailable = availableMergeOptions.length === 0;
    const effectiveMergeMode = availableMergeOptions.some(
        (o) => o.value === mergeMode,
    )
        ? mergeMode
        : (availableMergeOptions[0]?.value ?? "merge");

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
    const approvalCount = reviewStates.filter((s) => s === "APPROVED").length;
    const changesRequestedCount = reviewStates.filter(
        (s) => s === "CHANGES_REQUESTED",
    ).length;
    const pendingCount = [...requestedReviewerLogins].filter(
        (login) => !reviewStateMap.has(login),
    ).length;
    const requiredApprovalCount = mergeReqs?.requiredApprovingReviewCount ?? 0;
    const requiredChecks = mergeReqs?.requiredChecks ?? [];

    const isHeader = variant === "header";
    const showTitle = isHeader && isSticky;

    return (
        <div className="flex flex-nowrap items-center justify-end gap-2">
            {showTitle && (
                <Title
                    pullRequest={pullRequest}
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            )}
            {conflictedFiles.length > 0 && variant !== "header" ? (
                <ConflictedFiles
                    owner={owner}
                    repo={repo}
                    number={number}
                    pullRequest={pullRequest}
                    conflictedFiles={conflictedFiles}
                    compact
                />
            ) : null}
            {canInteract && !dismissReviewMutation.isPending && (
                <SubmitReviewButton
                    owner={owner}
                    repo={repo}
                    number={number}
                    pendingReview={pendingReview}
                    pendingCommentsCount={pendingCommentsCount}
                    isDiscarding={dismissReviewMutation.isPending}
                    navigateAndScroll={navigateAndScroll}
                    onDiscardReview={handleCancelReview}
                    isAuthor={isAuthor}
                />
            )}
            {!effectiveMerged && pullRequest.state === "open" && !isDraft && (
                <MergeStatusBar
                    pullRequest={pullRequest}
                    isDraft={isDraft}
                    canMerge={canMerge}
                    canWrite={canWrite}
                    mergeMode={mergeMode}
                    onMergeModeChange={setMergeMode}
                    onMerge={() => {
                        mergeMutation.mutate({
                            owner,
                            repo,
                            number,
                            mergeMethod: effectiveMergeMode,
                        });
                    }}
                    isMerging={mergeMutation.isPending}
                    availableMergeOptions={availableMergeOptions}
                    isMergeBlocked={isMergeBlocked}
                    isMergeStateUnknown={isMergeStateUnknown}
                    noMergeMethodsAvailable={noMergeMethodsAvailable}
                    mergeError={mergeMutation.isError}
                    // React Query keeps the last `data` across failed
                    // background refetches; only treat requirements as
                    // unavailable when there is genuinely nothing to show.
                    isMergeRequirementsUnavailable={
                        mergeReqsError && !mergeReqs
                    }
                    approvalCount={approvalCount}
                    changesRequestedCount={changesRequestedCount}
                    pendingReviewerCount={pendingCount}
                    requiredApprovalCount={requiredApprovalCount}
                    requiredChecks={requiredChecks}
                    checkRuns={checkRuns}
                    isMergeStatusLoading={isMergeStatusLoading || stackLoading}
                    isStackMerge={isStackMerge}
                    isBlockedByStack={stackMergeBlocked}
                />
            )}
            {effectiveMerged && (
                <div className="flex items-center gap-2">
                    {canWrite && canInteract ? (
                        <RevertButton
                            owner={owner}
                            repo={repo}
                            number={number}
                            pullRequest={pullRequest}
                        />
                    ) : null}
                </div>
            )}
            {markAsDraftMutation.isError && (
                <p className="text-red-600 text-xs">
                    Failed to mark as draft. Please try again.
                </p>
            )}
            {closeMutation.isError && (
                <p className="text-red-600 text-xs">
                    Failed to close. Please try again.
                </p>
            )}
            {reopenMutation.isError && (
                <p className="text-red-600 text-xs">
                    Failed to reopen. Please try again.
                </p>
            )}
            {!effectiveMerged &&
                pullRequest.state === "open" &&
                (isDraft && canManagePR ? (
                    <ReadyForReviewButton
                        owner={owner}
                        repo={repo}
                        number={number}
                        setMarkedReady={setMarkedReady}
                    />
                ) : null)}
        </div>
    );
}
function Title({
    pullRequest,
    number,
    owner,
    repo,
}: {
    pullRequest: PullsGetResponseData;
    number: number;
    owner: string;
    repo: string;
}) {
    const state = extractPullRequestState(pullRequest);
    const user = pullRequest.user;

    return (
        <div className="mr-auto flex min-w-0 flex-1 items-center gap-2">
            <StatusPill state={state} />
            <span className="min-w-0 truncate font-medium text-sm text-text-primary">
                <CodeTitle provider="gh" owner={owner} repo={repo}>
                    {pullRequest.title}
                </CodeTitle>{" "}
                <span className="text-text-muted">#{number}</span>
            </span>
            {user && (
                <UserHoverCard login={user.login}>
                    <NextLink href={user.html_url}>
                        <Image
                            alt={user.login}
                            className="h-5 w-5 shrink-0 rounded-full"
                            src={user.avatar_url}
                            width={20}
                            height={20}
                        />
                    </NextLink>
                </UserHoverCard>
            )}
        </div>
    );
}
