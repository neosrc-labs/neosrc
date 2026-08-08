"use client";

import { Undo2 } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/code-title";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
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
import { EMPTY_ARRAY_PROMISE, NULL_PROMISE } from "~/utils/promise";
import { ConflictedFiles } from "../conflicted-files";
import { MergeStatusBar } from "./merge-status-bar";

interface ActionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
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
    userPermissionPromise,
    currentUserLogin,
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

    const { data: mergeReqs, isLoading: mergeReqsLoading } =
        api.pulls.getMergeRequirements.useQuery(
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
                                    promise={
                                        userPermissionPromise ?? NULL_PROMISE
                                    }
                                >
                                    {(userPermission) => (
                                        <Buttons
                                            owner={owner}
                                            repo={repo}
                                            number={number}
                                            pullRequest={pullRequest}
                                            conflictedFiles={files}
                                            userPermission={userPermission}
                                            repoData={repoData}
                                            reviews={reviews}
                                            mergeReqs={mergeReqs}
                                            pendingReview={pendingReview}
                                            variant={variant}
                                            isSticky={isSticky}
                                            checkRuns={checkRuns}
                                            currentUserLogin={currentUserLogin}
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
    userPermission,
    repoData,
    reviews,
    pendingReview,
    mergeReqs,
    currentUserLogin,
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
    conflictedFiles: string[];
    currentUserLogin?: string;
    userPermission: string | null;
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
    const isAuthor = currentUserLogin === pullRequest.user?.login;

    const canWrite = userPermission === "admin" || userPermission === "write";
    const canManagePR = isAuthor || canWrite;
    const canMerge = canWrite;
    const canInteract =
        !!currentUserLogin && (!pullRequest.locked || canWrite || isAuthor);
    const isMergeBlocked = pullRequest.mergeable_state === "blocked";
    const isMergeStateUnknown = pullRequest.mergeable_state === "unknown";

    const mergeOptionDefs = [
        {
            value: "merge" as const,
            label: "Create a merge commit",
            description:
                "All commits will be added to the base branch via a merge commit.",
            allowed: repoData?.allowMergeCommit !== false,
        },
        {
            value: "squash" as const,
            label: "Squash and merge",
            description: "All commits will be squashed into a single commit.",
            allowed: repoData?.allowSquashMerge !== false,
        },
        {
            value: "rebase" as const,
            label: "Rebase and merge",
            description:
                "All commits will be added to the base branch individually.",
            allowed: repoData?.allowRebaseMerge !== false,
        },
    ];
    const availableMergeOptions = mergeOptionDefs.filter((o) => o.allowed);
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
                    approvalCount={approvalCount}
                    changesRequestedCount={changesRequestedCount}
                    pendingReviewerCount={pendingCount}
                    requiredApprovalCount={requiredApprovalCount}
                    requiredChecks={requiredChecks}
                    checkRuns={checkRuns}
                    isMergeStatusLoading={isMergeStatusLoading}
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

function ReadyForReviewButton({
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

function SubmitReviewButton({
    owner,
    repo,
    number,
    pendingReview,
    pendingCommentsCount,
    isDiscarding,
    navigateAndScroll,
    onDiscardReview,
    isAuthor,
}: {
    owner: string;
    repo: string;
    number: number;
    pendingReview?: PendingReview | null;
    pendingCommentsCount: number;
    isDiscarding: boolean;
    navigateAndScroll: () => void;
    onDiscardReview: () => void;
    isAuthor: boolean;
}) {
    const utils = api.useUtils();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [body, setBody] = useState("");
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const approveMutation = api.pulls.approve.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            navigateAndScroll();
        },
    });

    const submitReviewMutation = api.reviews.submit.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
            utils.reviewComments.list.invalidate();
            utils.timeline.list.invalidate();
            navigateAndScroll();
        },
    });

    const handleSubmitAction = useCallback(
        (event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES") => {
            const cleanup = () => {
                setIsPopoverOpen(false);
                setBody("");
                setShowDiscardConfirm(false);
            };

            if (pendingReview) {
                submitReviewMutation.mutate(
                    {
                        owner,
                        repo,
                        number,
                        reviewId: pendingReview.reviewId,
                        event,
                        body: body || undefined,
                    },
                    {
                        onSuccess: cleanup,
                    },
                );
            } else {
                approveMutation.mutate(
                    { owner, repo, number, event, body: body || undefined },
                    { onSuccess: cleanup },
                );
            }
        },
        [
            owner,
            repo,
            number,
            pendingReview,
            body,
            approveMutation,
            submitReviewMutation,
        ],
    );
    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <button
                    suppressHydrationWarning
                    className="flex cursor-pointer items-center gap-1.5 text-nowrap rounded-md bg-[#0969da] px-1.5 py-2 font-medium text-white text-xs transition-colors hover:bg-[#0860ca] sm:px-3"
                    type="button"
                >
                    Submit Review
                    {pendingReview && pendingCommentsCount > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 font-bold text-2xs leading-none">
                            {pendingCommentsCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[42rem] bg-surface p-4"
                side="top"
                sideOffset={8}
            >
                <MarkdownEditor
                    autoFocus
                    disabled={false /* FIXME: do this */}
                    minHeight="150px"
                    onChange={setBody}
                    onCancel={() => {
                        setIsPopoverOpen(false);
                        setBody("");
                        setShowDiscardConfirm(false);
                    }}
                    owner={owner}
                    placeholder="Leave a review comment"
                    repo={repo}
                    cancelLabel="Cancel"
                    value={body}
                    footerActions={[
                        {
                            label: "Comment",
                            onClick: () => handleSubmitAction("COMMENT"),
                            variant: "neutral",
                            disabled: (text: string) => !text.trim(),
                        },
                        {
                            label: "Approve",
                            onClick: () => handleSubmitAction("APPROVE"),
                            variant: "approve",
                            disabled: isAuthor,
                        },
                        {
                            label: "Request Changes",
                            onClick: () =>
                                handleSubmitAction("REQUEST_CHANGES"),
                            variant: "danger",
                            disabled: isAuthor,
                        },
                    ]}
                />
                {pendingReview && (
                    <div className="mt-3 border-gray-200 border-t pt-3 dark:border-zinc-600">
                        {showDiscardConfirm ? (
                            <div>
                                <p className="mb-1 font-medium text-sm text-text-primary">
                                    Delete this pending review?
                                </p>
                                <p className="mb-3 text-text-secondary text-xs">
                                    Your pending comments will be discarded.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        className="cursor-pointer rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                                        onClick={() =>
                                            setShowDiscardConfirm(false)
                                        }
                                        type="button"
                                    >
                                        Keep editing
                                    </button>
                                    <button
                                        className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-red-700"
                                        disabled={isDiscarding}
                                        onClick={() => {
                                            setShowDiscardConfirm(false);
                                            onDiscardReview();
                                        }}
                                        type="button"
                                    >
                                        {isDiscarding
                                            ? "Discarding..."
                                            : "Delete review"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="cursor-pointer font-medium text-text-secondary text-xs underline decoration-dotted underline-offset-2 transition-colors hover:text-red-600"
                                onClick={() => setShowDiscardConfirm(true)}
                                type="button"
                            >
                                Discard review
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
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

function RevertButton({
    owner,
    repo,
    number,
    pullRequest,
}: {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
}) {
    const utils = api.useUtils();
    const router = useRouter();
    const [isRevertPopoverOpen, setIsRevertPopoverOpen] = useState(false);
    const [revertTitle, setRevertTitle] = useState("");
    const [revertBody, setRevertBody] = useState("");
    const [revertDraft, setRevertDraft] = useState(false);

    const revertMutation = api.pulls.revert.useMutation({
        onSuccess: (data) => {
            setIsRevertPopoverOpen(false);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.push(
                `/gh/${owner}/${repo}/pull/${data.revertPullRequest.number}`,
            );
        },
    });

    const openRevertDialog = useCallback(
        (pullRequest: PullsGetResponseData) => {
            setRevertTitle(`Revert "${pullRequest.title}"`);
            setRevertBody(`Reverts ${owner}/${repo}#${number}`);
            setRevertDraft(false);
            setIsRevertPopoverOpen(true);
        },
        [owner, repo, number],
    );

    const handleRevert = useCallback(() => {
        revertMutation.mutate({
            owner,
            repo,
            number,
            title: revertTitle || undefined,
            body: revertBody || undefined,
            draft: revertDraft || undefined,
        });
    }, [
        owner,
        repo,
        number,
        revertTitle,
        revertBody,
        revertDraft,
        revertMutation,
    ]);
    return (
        <Popover
            open={isRevertPopoverOpen}
            onOpenChange={setIsRevertPopoverOpen}
        >
            <PopoverTrigger asChild>
                <button
                    suppressHydrationWarning
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-1.5 py-2.5 text-text-secondary text-xs transition-colors hover:bg-surface-tertiary sm:px-3 dark:border-zinc-600"
                    disabled={revertMutation.isPending}
                    onClick={() => openRevertDialog(pullRequest)}
                    type="button"
                >
                    <Undo2 size={14} />
                    {revertMutation.isPending ? "Reverting..." : "Revert"}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-2xl bg-surface p-4"
                side="top"
                sideOffset={8}
            >
                <div className="mb-3 flex items-center gap-1.5">
                    <Undo2 size={14} className="text-text-label" />
                    <span className="font-medium text-sm text-text-primary">
                        Revert this pull request
                    </span>
                </div>
                <p className="mb-3 text-text-secondary text-xs">
                    A new pull request will be created that reverts the changes
                    from <span className="font-mono">#{number}</span>.
                </p>
                <label
                    className="mb-1 block font-medium text-text-label text-xs"
                    htmlFor="revert-title-input"
                >
                    Title
                </label>
                <input
                    className="mb-3 w-full rounded-md border border-gray-300 bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600"
                    disabled={revertMutation.isPending}
                    id="revert-title-input"
                    onChange={(e) => setRevertTitle(e.target.value)}
                    type="text"
                    value={revertTitle}
                />
                <label
                    className="mb-1 block font-medium text-text-label text-xs"
                    htmlFor="revert-body-input"
                >
                    Body
                </label>
                <MarkdownEditor
                    autoFocus
                    disabled={revertMutation.isPending}
                    minHeight="120px"
                    onChange={setRevertBody}
                    onCancel={() => setIsRevertPopoverOpen(false)}
                    owner={owner}
                    placeholder="Describe the revert"
                    repo={repo}
                    cancelLabel="Cancel"
                    value={revertBody}
                    footerActions={[
                        {
                            label: revertMutation.isPending
                                ? "Reverting..."
                                : "Revert",
                            onClick: () => handleRevert(),
                            variant: "neutral",
                            disabled: revertMutation.isPending,
                        },
                    ]}
                />
                <label className="mt-2 flex items-center gap-2 text-text-secondary text-xs">
                    <input
                        checked={revertDraft}
                        disabled={revertMutation.isPending}
                        onChange={(e) => setRevertDraft(e.target.checked)}
                        type="checkbox"
                    />
                    Create as draft
                </label>
            </PopoverContent>
        </Popover>
    );
}
