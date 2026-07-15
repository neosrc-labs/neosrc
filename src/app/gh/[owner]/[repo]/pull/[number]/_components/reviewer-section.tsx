"use client";

import { Check, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, opId } from "~/lib/utils";
import type { Assignee, PullsGetResponseData, Reviewer } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type ReviewerOperation = {
    id: number;
    op: "add" | "remove";
    reviewer: Reviewer;
};

export function ReviewerSection({
    pullRequestPromise,
    userPermission,
    owner,
    repo,
    number,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
    userPermission: Promise<string | null>;
    owner: string;
    repo: string;
    number: number;
}) {
    const [operations, setOperations] = useState<ReviewerOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
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

    function buildReviewStateMap(
        reviews: Array<{ user: { login: string } | null; state: string }>,
    ): Map<string, string> {
        const map = new Map<string, string>();
        for (const review of reviews) {
            if (review.user && !map.has(review.user.login)) {
                map.set(review.user.login, review.state);
            }
        }
        return map;
    }

    return (
        <>
            <div className="flex items-start justify-between">
                <h3 className="text-text-primary">Reviewers</h3>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <Async promise={userPermission} fallback={null}>
                            {(permission) => (
                                <ReviewerSectionSettings
                                    repoUsers={usersData.filter(
                                        (u) =>
                                            u.login !== pullRequest.user?.login,
                                    )}
                                    reviewers={mergeReviewers(
                                        pullRequest.requested_reviewers ?? [],
                                        reviewsQuery.data ?? [],
                                        pullRequest.user.login,
                                    )}
                                    operations={operations}
                                    onAddReviewer={handleAdd}
                                    onRemoveReviewer={handleRemove}
                                    disabled={
                                        permission !== "admin" &&
                                        permission !== "write"
                                    }
                                />
                            )}
                        </Async>
                    )}
                </Async>
            </div>
            <Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
                {(pullRequest) => {
                    if (reviewsQuery.isPending) {
                        return <FieldSkeleton />;
                    }
                    const reviewStateMap = buildReviewStateMap(
                        reviewsQuery.data ?? [],
                    );
                    return (
                        <ReviewerSectionContent
                            reviewers={mergeReviewers(
                                pullRequest.requested_reviewers ?? [],
                                reviewsQuery.data ?? [],
                                pullRequest.user.login,
                            )}
                            reviewStateMap={reviewStateMap}
                            operations={operations}
                        />
                    );
                }}
            </Async>
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
                    <img
                        src={r.avatar_url}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full"
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
    operations,
}: {
    reviewers: Reviewer[];
    reviewStateMap: Map<string, string>;
    operations: ReviewerOperation[];
}) {
    const displayReviewers = applyOperations(reviewers, operations);

    if (displayReviewers.length === 0) {
        return <p className="text-sm text-text-tertiary">No reviewers</p>;
    }

    return (
        <ul className="space-y-2">
            {displayReviewers.map((reviewer) => {
                const state = reviewStateMap.get(reviewer.login) ?? "PENDING";
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
                                <img
                                    alt={reviewer.login}
                                    className="h-5 w-5 rounded-full"
                                    src={reviewer.avatar_url}
                                />
                                <span className="text-text-secondary">
                                    {reviewer.login}
                                </span>
                            </a>
                        </UserHoverCard>
                        {state === "APPROVED" && (
                            <Check
                                className="ml-auto text-green-600"
                                size={16}
                            />
                        )}
                        {state === "PENDING" && (
                            <Circle
                                className="ml-auto fill-yellow-500 text-yellow-500"
                                size={16}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
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
