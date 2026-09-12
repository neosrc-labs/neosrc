"use client";

import {
    Check,
    ChevronDown,
    Circle,
    CircleSlash,
    MessageSquare,
    MoreVertical,
    RefreshCw,
    XCircle,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { applyArrayOperations, opId } from "~/lib/utils";
import type {
    Assignee,
    PullsGetResponseData,
    ReviewComment2,
    Reviewer,
} from "~/server/github";
import { api } from "~/trpc/react";
import {
    canEdit,
    canPush,
    type PullRequestPermissionContext,
} from "../permissions-utils";
import { DismissReviewDialog } from "./dismiss-review-dialog";
import { FieldSkeleton } from "./metadata-section";

const MAX_VISIBLE_REVIEWERS = 10;

type ReviewerOperation = {
    id: number;
    op: "add" | "remove";
    reviewer: Reviewer;
};

export function ReviewerSection({
    pullRequestPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}) {
    const [operations, setOperations] = useState<ReviewerOperation[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [reRequestedLogins, setReRequestedLogins] = useState<Set<string>>(
        new Set(),
    );
    const [dismissTarget, setDismissTarget] = useState<{
        reviewId: number;
        login: string;
    } | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the state
    useEffect(() => {
        setOperations([]);
        setShowAll(false);
        setReRequestedLogins(new Set());
        setDismissTarget(null);
    }, [pullRequestPromise]);

    const { data: repoUsers } = api.pulls.listAssignees.useQuery({
        provider: "gh",
        owner,
        repo,
    });
    const usersData = (repoUsers ?? []) as Assignee[];
    const addMutation = api.pulls.addReviewer.useMutation();
    const removeMutation = api.pulls.removeReviewer.useMutation();
    const reviewsQuery = api.pulls.listReviews.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );
    // React Query dedupes these against the merge box's identical queries.
    const mergeReqsQuery = api.pulls.getMergeRequirements.useQuery(
        { owner, repo, number },
        { staleTime: 60_000 },
    );
    const mergeStateQuery = api.pulls.getMergeState.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const reviews = reviewsQuery.data ?? [];
    const reviewStateMap = buildReviewStateMap(reviews);
    const requiredApprovals =
        mergeReqsQuery.data?.requiredApprovingReviewCount ?? 0;
    const approvedCount = [...reviewStateMap.values()].filter(
        (state) => state === "APPROVED",
    ).length;
    // Wait for the requirement count so the header badge does not pop in.
    const showRequiredApprovals =
        requiredApprovals > 0 &&
        !reviewsQuery.isPending &&
        !mergeReqsQuery.isPending;

    const handleAdd = (reviewer: Reviewer) => {
        const repoUser = usersData.find((u) => u.login === reviewer.login);
        if (!repoUser) return;

        const id = opId();
        setOperations((prev) => [...prev, { id, op: "add", reviewer }]);
        addMutation.mutate(
            { owner, repo, number, reviewer: reviewer.login },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id !== id));
                },
            },
        );
    };

    const handleRemove = (reviewer: Reviewer) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, op: "remove", reviewer }]);
        removeMutation.mutate(
            { owner, repo, number, reviewer: reviewer.login },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id !== id));
                },
            },
        );
    };

    /**
     * Re-request a review from someone who already reviewed. Same request as
     * adding a reviewer; the login is tracked locally so the row shows as
     * pending until the request is fulfilled.
     */
    const handleReRequestReview = (reviewer: Reviewer) => {
        setReRequestedLogins((prev) => new Set(prev).add(reviewer.login));
        addMutation.mutate(
            { owner, repo, number, reviewer: reviewer.login },
            {
                onError: () => {
                    setReRequestedLogins((prev) => {
                        const next = new Set(prev);
                        next.delete(reviewer.login);
                        return next;
                    });
                },
            },
        );
    };

    function mergeReviewers(
        requested: Reviewer[],
        reviews: Array<{ user: Reviewer | null }>,
        author?: string,
    ): Reviewer[] {
        const reviewerUsers = reviews
            .map((r) => r.user)
            .filter(
                (u): u is NonNullable<typeof u> =>
                    u != null && u.login !== author,
            );
        const seen = new Set<string>();
        return [...requested, ...reviewerUsers].filter((u) => {
            if (seen.has(u.login)) return false;
            seen.add(u.login);
            return true;
        });
    }

    /**
     * Latest review decision per reviewer. Pending requests are handled at
     * display time so a re-request does not clear an existing approval.
     */
    function buildReviewStateMap(
        reviews: Array<{
            user: { login: string } | null;
            state: string;
            submitted_at?: string | null;
        }>,
    ): Map<string, string> {
        const map = new Map<string, string>();
        for (const review of reviews) {
            if (!review.user) continue;
            const login = review.user.login;
            const state = review.state;
            if (state === "APPROVED" || state === "CHANGES_REQUESTED") {
                map.set(login, state);
            } else if (state === "DISMISSED") {
                map.set(login, "DISMISSED");
            } else if (state === "COMMENTED" && !map.has(login)) {
                map.set(login, "COMMENTED");
            }
        }
        return map;
    }

    function buildReviewSortMap(
        reviews: Array<{
            user: { login: string } | null;
            submitted_at?: string | null;
        }>,
    ): Map<string, number> {
        const map = new Map<string, number>();
        for (const review of reviews) {
            if (!review.user || !review.submitted_at) continue;
            const ts = new Date(review.submitted_at).getTime();
            const current = map.get(review.user.login);
            if (current === undefined || ts > current) {
                map.set(review.user.login, ts);
            }
        }
        return map;
    }

    /**
     * Latest review per reviewer that is still dismissable. Follows
     * buildReviewStateMap's ordering so the menu only shows where an
     * approved or changes-requested state is displayed.
     */
    function buildDismissableReviewMap(
        reviews: ReviewComment2[],
    ): Map<string, number> {
        const map = new Map<string, number>();
        for (const review of reviews) {
            if (!review.user) continue;
            const login = review.user.login;
            if (
                review.state === "APPROVED" ||
                review.state === "CHANGES_REQUESTED"
            ) {
                map.set(login, review.id);
            } else if (review.state === "DISMISSED") {
                map.delete(login);
            }
        }
        return map;
    }

    return (
        <>
            <div className="flex items-start justify-between">
                <div className="flex items-baseline gap-1.5">
                    <h3 className="text-text-primary">Reviewers</h3>
                    {showRequiredApprovals && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-default text-text-tertiary text-xs">
                                    ({approvedCount} of {requiredApprovals})
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                {approvedCount} of {requiredApprovals} required
                                approvals
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <Async
                            promise={permissionContextPromise}
                            fallback={null}
                        >
                            {(permissionContext) => (
                                <ReviewerSectionSettings
                                    repoUsers={usersData.filter(
                                        (u) =>
                                            u.login !== pullRequest.user?.login,
                                    )}
                                    reviewers={mergeReviewers(
                                        pullRequest.requested_reviewers ?? [],
                                        reviewsQuery.data ?? [],
                                        pullRequest.user?.login,
                                    )}
                                    operations={operations}
                                    onAddReviewer={handleAdd}
                                    onRemoveReviewer={handleRemove}
                                    disabled={!canEdit(permissionContext)}
                                />
                            )}
                        </Async>
                    )}
                </Async>
            </div>
            <Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
                {(pullRequest) => {
                    if (reviewsQuery.isPending || mergeReqsQuery.isPending) {
                        return <FieldSkeleton />;
                    }
                    const reviewSortMap = buildReviewSortMap(reviews);
                    const dismissableReviewMap =
                        buildDismissableReviewMap(reviews);
                    const requestedLogins = new Set([
                        ...(pullRequest.requested_reviewers ?? []).map(
                            (r) => r.login,
                        ),
                        ...reRequestedLogins,
                    ]);
                    return (
                        <Async
                            promise={permissionContextPromise}
                            fallback={null}
                        >
                            {(permissionContext) => (
                                <ReviewerSectionContent
                                    reviewers={mergeReviewers(
                                        pullRequest.requested_reviewers ?? [],
                                        reviews,
                                        pullRequest.user?.login,
                                    )}
                                    reviewStateMap={reviewStateMap}
                                    reviewSortMap={reviewSortMap}
                                    dismissableReviewMap={dismissableReviewMap}
                                    requestedLogins={requestedLogins}
                                    canReRequestReviews={canEdit(
                                        permissionContext,
                                    )}
                                    onReRequestReview={handleReRequestReview}
                                    canDismissReviews={canPush(
                                        permissionContext,
                                    )}
                                    onDismissReview={(reviewId, login) =>
                                        setDismissTarget({
                                            reviewId,
                                            login,
                                        })
                                    }
                                    codeOwnerLogins={
                                        new Set(
                                            mergeStateQuery.data
                                                ?.codeOwnerReviewerLogins ?? [],
                                        )
                                    }
                                    operations={operations}
                                    showAll={showAll}
                                    onToggleShowAll={() =>
                                        setShowAll((prev) => !prev)
                                    }
                                />
                            )}
                        </Async>
                    );
                }}
            </Async>
            {dismissTarget && (
                <DismissReviewDialog
                    owner={owner}
                    repo={repo}
                    number={number}
                    reviewId={dismissTarget.reviewId}
                    reviewerLogin={dismissTarget.login}
                    onClose={() => setDismissTarget(null)}
                />
            )}
        </>
    );
}

function ReviewerSectionSettings({
    repoUsers,
    reviewers,
    operations,
    onAddReviewer,
    onRemoveReviewer,
    disabled,
}: {
    repoUsers: Reviewer[];
    reviewers: Reviewer[];
    operations: ReviewerOperation[];
    onAddReviewer: (reviewer: Reviewer) => void;
    onRemoveReviewer: (reviewer: Reviewer) => void;
    disabled?: boolean;
}) {
    const displayReviewers = applyOperations(reviewers, operations);
    const currentLogins = new Set(displayReviewers.map((r) => r.login));

    return (
        <SearchableDropdown
            items={repoUsers}
            isSelected={(r) => currentLogins.has(r.login)}
            onSelect={(r) =>
                currentLogins.has(r.login)
                    ? onRemoveReviewer(r)
                    : onAddReviewer(r)
            }
            keyFn={(r) => r.login}
            searchFn={(r, q) => r.login.toLowerCase().includes(q)}
            renderItem={(r, selected) => (
                <>
                    <Image
                        src={r.avatar_url}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full"
                        width={20}
                        height={20}
                    />
                    <span className="flex-1 truncate text-text-label">
                        {r.login}
                    </span>
                    {selected && (
                        <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </>
            )}
            placeholder="Filter users"
            emptyText="No users found"
            ariaLabel="Manage reviewers"
            disabled={disabled}
        />
    );
}

function ReviewerSectionContent({
    reviewers,
    reviewStateMap,
    reviewSortMap,
    dismissableReviewMap,
    requestedLogins,
    canReRequestReviews,
    onReRequestReview,
    canDismissReviews,
    onDismissReview,
    codeOwnerLogins,
    operations,
    showAll,
    onToggleShowAll,
}: {
    reviewers: Reviewer[];
    reviewStateMap: Map<string, string>;
    reviewSortMap: Map<string, number>;
    dismissableReviewMap: Map<string, number>;
    requestedLogins: Set<string>;
    canReRequestReviews: boolean;
    onReRequestReview: (reviewer: Reviewer) => void;
    canDismissReviews: boolean;
    onDismissReview: (reviewId: number, login: string) => void;
    codeOwnerLogins: Set<string>;
    operations: ReviewerOperation[];
    showAll: boolean;
    onToggleShowAll: () => void;
}) {
    const displayReviewers = applyOperations(reviewers, operations);

    const sortedReviewers = [...displayReviewers].sort((a, b) => {
        const aTs = reviewSortMap.get(a.login);
        const bTs = reviewSortMap.get(b.login);
        if (aTs !== undefined && bTs !== undefined) return aTs - bTs;
        if (aTs !== undefined) return -1;
        if (bTs !== undefined) return 1;
        return a.login.localeCompare(b.login);
    });

    if (sortedReviewers.length === 0) {
        return <p className="text-sm text-text-tertiary">No reviewers</p>;
    }

    const visibleReviewers = showAll
        ? sortedReviewers
        : sortedReviewers.slice(0, MAX_VISIBLE_REVIEWERS);
    const hiddenCount = sortedReviewers.length - visibleReviewers.length;

    return (
        <>
            <ul
                className={`space-y-2 ${
                    showAll ? "max-h-80 overflow-y-auto" : ""
                }`}
            >
                {visibleReviewers.map((reviewer) => {
                    const isPending = requestedLogins.has(reviewer.login);
                    const state = isPending
                        ? "PENDING"
                        : (reviewStateMap.get(reviewer.login) ?? "PENDING");
                    const dismissableReviewId = dismissableReviewMap.get(
                        reviewer.login,
                    );
                    const showReRequest = canReRequestReviews && !isPending;
                    const showDismiss =
                        canDismissReviews && dismissableReviewId !== undefined;
                    return (
                        <li
                            className="group flex items-center gap-2 text-sm"
                            key={reviewer.login}
                        >
                            <UserHoverCard login={reviewer.login}>
                                <a
                                    className="flex items-center gap-2"
                                    href={reviewer.html_url}
                                >
                                    <Image
                                        alt={reviewer.login}
                                        className="h-5 w-5 rounded-full"
                                        src={reviewer.avatar_url}
                                        width={20}
                                        height={20}
                                    />
                                    <span className="text-text-secondary">
                                        {reviewer.login}
                                    </span>
                                </a>
                            </UserHoverCard>
                            {codeOwnerLogins.has(reviewer.login) && (
                                <span className="shrink-0 text-text-tertiary text-xs">
                                    code owner
                                </span>
                            )}
                            <span className="ml-auto flex items-center gap-1">
                                {(showReRequest || showDismiss) && (
                                    <ReviewerActionsMenu
                                        login={reviewer.login}
                                        canReRequest={showReRequest}
                                        onReRequest={() =>
                                            onReRequestReview(reviewer)
                                        }
                                        canDismiss={showDismiss}
                                        onDismiss={() =>
                                            dismissableReviewId !== undefined &&
                                            onDismissReview(
                                                dismissableReviewId,
                                                reviewer.login,
                                            )
                                        }
                                    />
                                )}
                                {state === "APPROVED" && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Check
                                                className="text-green-600"
                                                size={16}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            {reviewer.login} approved these
                                            changes
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {state === "CHANGES_REQUESTED" && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <XCircle
                                                className="text-red-600"
                                                size={16}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            {reviewer.login} requested changes
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {state === "COMMENTED" && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <MessageSquare
                                                className="text-text-muted"
                                                size={13}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            {reviewer.login} left review
                                            comments
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {state === "PENDING" && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Circle
                                                className="fill-yellow-500 text-yellow-500"
                                                size={8}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            Awaiting requested review from{" "}
                                            {reviewer.login}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {sortedReviewers.length > MAX_VISIBLE_REVIEWERS && (
                <button
                    type="button"
                    aria-expanded={showAll}
                    onClick={onToggleShowAll}
                    className="mt-1 flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-text-tertiary text-xs transition-colors hover:bg-surface-selected hover:text-text-label dark:hover:text-zinc-300"
                >
                    <ChevronDown
                        size={14}
                        className={showAll ? "rotate-180" : ""}
                    />
                    {showAll
                        ? "Show less"
                        : `Show ${hiddenCount} more reviewer${hiddenCount === 1 ? "" : "s"}`}
                </button>
            )}
        </>
    );
}

function ReviewerActionsMenu({
    login,
    canReRequest,
    onReRequest,
    canDismiss,
    onDismiss,
}: {
    login: string;
    canReRequest: boolean;
    onReRequest: () => void;
    canDismiss: boolean;
    onDismiss: () => void;
}) {
    const [open, setOpen] = useState(false);
    const itemClass =
        "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary";
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`More options for ${login}`}
                    className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                >
                    <MoreVertical size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-surface p-1" align="end">
                {canReRequest && (
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onReRequest();
                        }}
                        className={itemClass}
                    >
                        <RefreshCw size={14} />
                        Re-request review
                    </button>
                )}
                {canDismiss && (
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onDismiss();
                        }}
                        className={itemClass}
                    >
                        <CircleSlash size={14} />
                        Dismiss review
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
}

function applyOperations(
    reviewers: Reviewer[],
    operations: ReviewerOperation[],
): Reviewer[] {
    return applyArrayOperations(
        reviewers,
        operations,
        (op) => op.reviewer,
        (r) => r.login,
    );
}
