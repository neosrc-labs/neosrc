"use client";

import { File, FilePen, GitMerge, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { CodeTitle } from "~/components/markdown/code-title";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
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
import type { PendingReview } from "~/server/api/routers/reviews";
import type { MergeMethod, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { MergeStatusBar } from "./merge-status-bar";
import { RequiredChecksList } from "./required-checks-list";
import { ReviewStatusBadges } from "./review-status-badges";

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
    const router = useRouter();
    const utils = api.useUtils();
    const [markedReady, setMarkedReady] = useState(false);
    const [isMerged, setIsMerged] = useState(false);
    const [isCancelPopoverOpen, setIsCancelPopoverOpen] = useState(false);
    const [mergeMode, setMergeMode] = useLocalStorage<MergeMethod>(
        "neosrc-merge-mode",
        "merge",
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: repoData } = api.repos.getByOwnerAndRepo.useQuery({
        provider: "gh",
        owner,
        repo,
    });

    const { data: reviews } = api.pulls.listReviews.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: mergeReqs } = api.pulls.getMergeRequirements.useQuery(
        { owner, repo, number },
        { staleTime: 60_000 },
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
            navigateAndScroll();
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

    const skeleton = (
        <>
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </>
    );

    const pendingCommentsCount = pendingReview?.comments.length ?? 0;

    const reviewInProgress = pendingReview != null && (
        <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
            <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
                    Review in progress
                </span>
                <Popover
                    open={isCancelPopoverOpen}
                    onOpenChange={setIsCancelPopoverOpen}
                >
                    <PopoverTrigger asChild>
                        <button
                            suppressHydrationWarning
                            className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                            disabled={dismissReviewMutation.isPending}
                            type="button"
                            title="Cancel review"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="w-64 bg-surface p-4"
                        side="top"
                        sideOffset={4}
                    >
                        <p className="mb-3 font-medium text-sm text-text-primary">
                            Delete this pending review?
                        </p>
                        <p className="mb-4 text-text-secondary text-xs">
                            Your pending comments will be discarded.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                className="cursor-pointer rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                                onClick={() => setIsCancelPopoverOpen(false)}
                                type="button"
                            >
                                Keep editing
                            </button>
                            <button
                                className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-red-700"
                                onClick={() => {
                                    setIsCancelPopoverOpen(false);
                                    handleCancelReview();
                                }}
                                type="button"
                            >
                                Delete review
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-500">
                {pendingCommentsCount} comment
                {pendingCommentsCount !== 1 ? "s" : ""} pending
            </p>
        </div>
    );

    const buttons = (
        pullRequest: PullsGetResponseData,
        conflictedFiles: string[],
        userPermission: string | null,
    ) => {
        const isDraft = !!pullRequest.draft && !markedReady;
        const effectiveMerged = pullRequest.merged || isMerged;
        const isAuthor = currentUserLogin === pullRequest.user?.login;

        const canWrite =
            userPermission === "admin" || userPermission === "write";
        const canManagePR = isAuthor || canWrite;
        const canMerge = canWrite;
        const canInteract = !pullRequest.locked || canWrite || isAuthor;
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
                description:
                    "All commits will be squashed into a single commit.",
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

        const conflictedFilesSection =
            conflictedFiles.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
                            Conflicting files
                        </span>
                    </div>
                    <ul className="space-y-1">
                        {conflictedFiles.map((file) => (
                            <li
                                key={file}
                                className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-yellow-700 dark:text-yellow-500"
                            >
                                <File size={12} className="shrink-0" />
                                <span className="truncate">{file}</span>
                            </li>
                        ))}
                    </ul>
                    {pullRequest.head.repo?.full_name ===
                        pullRequest.base.repo?.full_name && (
                        <a
                            href={`https://github.com/${owner}/${repo}/pull/${number}/conflicts`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 font-medium text-xs text-yellow-800 transition-colors hover:bg-yellow-200 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                        >
                            <FilePen size={12} />
                            Resolve
                        </a>
                    )}
                </div>
            ) : null;

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
        const requiredApprovalCount =
            mergeReqs?.requiredApprovingReviewCount ?? 0;
        const requiredChecks = mergeReqs?.requiredChecks ?? [];

        const isHeader = variant === "header";
        const showTitle = isHeader && isSticky;
        const state = extractPullRequestState(pullRequest);

        return (
            <div className="flex flex-wrap items-center justify-end gap-2">
                {showTitle && (
                    <div className="mr-auto flex min-w-0 flex-1 items-center gap-2">
                        <StatusPill state={state} />
                        <span className="min-w-0 truncate font-medium text-sm text-text-primary">
                            <CodeTitle>{pullRequest.title}</CodeTitle>{" "}
                            <span className="text-text-muted">#{number}</span>
                        </span>
                    </div>
                )}
                {conflictedFilesSection}
                {reviewInProgress}
                {!isMergeBlocked && pullRequest.state === "open" && (
                    <ReviewStatusBadges
                        approvalCount={approvalCount}
                        changesRequestedCount={changesRequestedCount}
                        pendingReviewerCount={pendingCount}
                        requiredApprovalCount={requiredApprovalCount}
                    />
                )}
                {canInteract &&
                    !isAuthor &&
                    !dismissReviewMutation.isPending && (
                        <div>
                            <SubmitReviewButton
                                owner={owner}
                                repo={repo}
                                number={number}
                                pendingReview={pendingReview}
                                navigateAndScroll={navigateAndScroll}
                            />
                        </div>
                    )}
                {!effectiveMerged &&
                    pullRequest.state === "open" &&
                    !isDraft && (
                        <>
                            {isDraft && canWrite && (
                                <ReadyForReviewButton
                                    owner={owner}
                                    repo={repo}
                                    number={number}
                                    setMarkedReady={setMarkedReady}
                                />
                            )}
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
                                noMergeMethodsAvailable={
                                    noMergeMethodsAvailable
                                }
                                mergeError={mergeMutation.isError}
                                approvalCount={approvalCount}
                                changesRequestedCount={changesRequestedCount}
                                pendingReviewerCount={pendingCount}
                                requiredApprovalCount={requiredApprovalCount}
                                requiredChecks={requiredChecks}
                                checkRuns={checkRuns}
                            />
                        </>
                    )}
                {effectiveMerged && (
                    <div className="flex items-center gap-2">
                        {!isHeader && (
                            <div className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-900/50 dark:bg-violet-950/30">
                                <GitMerge
                                    size={14}
                                    className="text-violet-600 dark:text-violet-400"
                                />
                                <span className="font-medium text-sm text-violet-700 dark:text-violet-300">
                                    Merged
                                </span>
                            </div>
                        )}
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
    };

    return (
        <div>
            {pullRequestPromise ? (
                <Async fallback={skeleton} promise={pullRequestPromise}>
                    {(pullRequest) => (
                        <Async
                            fallback={null}
                            promise={
                                conflictedFilesPromise ?? Promise.resolve([])
                            }
                        >
                            {(files) => (
                                <Async
                                    fallback={null}
                                    promise={
                                        userPermissionPromise ??
                                        Promise.resolve(null)
                                    }
                                >
                                    {(userPermission) =>
                                        buttons(
                                            pullRequest,
                                            files,
                                            userPermission,
                                        )
                                    }
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
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-gray-200 px-3 py-2 font-medium text-gray-800 text-sm transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
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
    navigateAndScroll,
}: {
    owner: string;
    repo: string;
    number: number;
    pendingReview?: PendingReview | null;
    navigateAndScroll: () => void;
}) {
    // TODO: this component needs to handle the pending state internally
    const utils = api.useUtils();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [body, setBody] = useState("");

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
                    className="cursor-pointer rounded-md bg-[#0969da] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#0860ca]"
                    type="button"
                >
                    Submit Review
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
                        },
                        {
                            label: "Request Changes",
                            onClick: () =>
                                handleSubmitAction("REQUEST_CHANGES"),
                            variant: "danger",
                        },
                    ]}
                />
            </PopoverContent>
        </Popover>
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
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary dark:border-zinc-600"
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
