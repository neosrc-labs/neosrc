"use client";

import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { cn, opId } from "~/lib/utils";
import type { Milestone, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type MilestoneOperation = { id: number; milestone: Milestone | null };

export function MilestoneSection({
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
    const [operations, setOperations] = useState<MilestoneOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [pullRequestPromise]);

    const { data: repoMilestones } = api.pulls.listMilestones.useQuery({
        owner,
        repo,
    });
    const setMutation = api.pulls.setMilestone.useMutation();

    const milestonesData = (repoMilestones ?? []) as Milestone[];
    const handleSet = (milestone: Milestone | null) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, milestone }]);
        setMutation.mutate(
            { owner, repo, number, milestone: milestone?.number ?? null },
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
                <h3 className="text-gray-900 dark:text-zinc-100">Milestone</h3>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <Async promise={userPermission} fallback={null}>
                            {(permission) => (
                                <MilestoneSectionSettings
                                    repoMilestones={milestonesData}
                                    milestone={pullRequest.milestone}
                                    operations={operations}
                                    onSetMilestone={handleSet}
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
            <Async
                promise={pullRequestPromise}
                fallback={
                    <div className="mt-2">
                        <FieldSkeleton />
                    </div>
                }
            >
                {(pullRequest) => (
                    <MilestoneSectionContent
                        milestone={pullRequest.milestone}
                        operations={operations}
                    />
                )}
            </Async>
        </>
    );
}

function MilestoneSectionSettings({
    repoMilestones,
    milestone,
    operations,
    onSetMilestone,
    disabled,
}: {
    repoMilestones: Milestone[];
    milestone: Milestone | null;
    operations: MilestoneOperation[];
    onSetMilestone: (milestone: Milestone | null) => void;
    disabled?: boolean;
}) {
    const currentMilestone = applyOperations(milestone, operations);
    const currentNumber = currentMilestone?.number ?? null;

    return (
        <SearchableDropdown
            items={repoMilestones}
            isSelected={(m) => m.number === currentNumber}
            onSelect={(m) => {
                if (m.number !== currentNumber) {
                    onSetMilestone(m);
                }
            }}
            keyFn={(m) => m.number}
            searchFn={(m, q) => m.title.toLowerCase().includes(q)}
            renderItem={(m, selected) => (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-gray-700 dark:text-zinc-300">
                        {m.title}
                    </span>
                    {m.description && (
                        <span className="truncate text-gray-400 text-xs">
                            {m.description}
                        </span>
                    )}
                    {selected && (
                        <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter milestones"
            emptyText="No milestones found"
            ariaLabel="Manage milestone"
            disabled={disabled}
            beforeItems={
                <li
                    className={cn(
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
                        currentNumber === null &&
                            "bg-blue-50 dark:bg-blue-950/30",
                    )}
                    onClick={() => {
                        if (currentNumber !== null) {
                            onSetMilestone(null);
                        }
                    }}
                    role="option"
                    aria-selected={currentNumber === null}
                >
                    <span className="flex-1 text-gray-500 italic dark:text-zinc-400">
                        No milestone
                    </span>
                    {currentNumber === null && (
                        <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </li>
            }
        />
    );
}

function MilestoneSectionContent({
    milestone,
    operations,
}: {
    milestone: Milestone | null;
    operations: MilestoneOperation[];
}) {
    const currentMilestone = applyOperations(milestone, operations);

    if (!currentMilestone) {
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No milestone
            </p>
        );
    }

    return (
        <a
            className="text-gray-600 text-sm hover:underline dark:text-zinc-400"
            href={currentMilestone.html_url}
            target="_blank"
            rel="noreferrer"
        >
            {currentMilestone.title}
        </a>
    );
}

function applyOperations(
    milestone: Milestone | null,
    operations: MilestoneOperation[],
): Milestone | null {
    let updatedMilestone = milestone;
    for (const op of operations) {
        updatedMilestone = op.milestone;
    }
    return updatedMilestone;
}
