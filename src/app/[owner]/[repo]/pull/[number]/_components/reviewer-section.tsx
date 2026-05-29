"use client";

import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, cn, opId } from "~/lib/utils";
import type { PullsGetResponseData, Reviewer } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type ReviewerOperation = {
    id: number;
    op: "add" | "remove";
    reviewer: Reviewer;
};

export function ReviewerSection({
    pullRequestPromise,
    owner,
    repo,
    number,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
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
        owner,
        repo,
    });
    const addMutation = api.pulls.addReviewer.useMutation();
    const removeMutation = api.pulls.removeReviewer.useMutation();

    const usersData = repoUsers ?? [];
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

    return (
        <>
            <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
                    Reviewers
                </h3>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <ReviewerSectionSettings
                            repoUsers={usersData.filter(
                                (u) => u.login !== pullRequest.user?.login,
                            )}
                            reviewers={pullRequest.requested_reviewers ?? []}
                            operations={operations}
                            onAddReviewer={handleAdd}
                            onRemoveReviewer={handleRemove}
                        />
                    )}
                </Async>
            </div>
            <Async
                promise={pullRequestPromise}
                fallback={
                    <div className="mt-2">
                        <FieldSkeleton />
                    </div>
                }
            >
                {(pullRequest) => (
                    <ReviewerSectionContent
                        reviewers={pullRequest.requested_reviewers ?? []}
                        operations={operations}
                        onRemoveReviewer={handleRemove}
                    />
                )}
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
}: {
    repoUsers: Reviewer[];
    reviewers: Reviewer[];
    operations: ReviewerOperation[];
    onAddReviewer: (reviewer: Reviewer) => void;
    onRemoveReviewer: (reviewer: Reviewer) => void;
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
                    <span className="flex-1 truncate text-gray-700 dark:text-zinc-300">
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
        />
    );
}

function ReviewerSectionContent({
    reviewers,
    operations,
    onRemoveReviewer,
}: {
    reviewers: Reviewer[];
    operations: ReviewerOperation[];
    onRemoveReviewer: (reviewer: Reviewer) => void;
}) {
    const displayReviewers = applyOperations(reviewers, operations);

    if (displayReviewers.length === 0) {
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No reviewers
            </p>
        );
    }

    return (
        <ul className="space-y-2">
            {displayReviewers.map((reviewer) => (
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
                            <span className="text-gray-600 dark:text-zinc-400">
                                {reviewer.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <button
                        className="ml-auto inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-400 opacity-0 hover:text-gray-600 group-hover:opacity-100 dark:hover:text-zinc-300"
                        onClick={() => onRemoveReviewer(reviewer)}
                        type="button"
                        aria-label={`Remove ${reviewer.login}`}
                    >
                        &times;
                    </button>
                </li>
            ))}
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
