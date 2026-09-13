"use client";

import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { cn, opId } from "~/lib/utils";
import type {
    IssueMetadata,
    IssueMilestone,
} from "~/server/api/routers/issues/types";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";
import { FieldSkeleton } from "./metadata-section";
import {
    canEdit,
    type PullRequestPermissionContext,
} from "./permissions-utils";

type MilestoneOperation = { id: number; milestone: IssueMilestone | null };

// Repo milestone list payload: GitHub exposes `number`, Codeberg `id`.
type RepoMilestone = {
    id: number;
    number?: number;
    title: string;
    description: string | null;
    html_url?: string;
};

const milestoneKey = (m: RepoMilestone): string => String(m.number ?? m.id);

const toMilestone = (m: RepoMilestone): IssueMilestone => ({
    id: milestoneKey(m),
    title: m.title,
    htmlUrl: m.html_url ?? "",
});

interface MilestoneSectionProps {
    provider: Provider;
    /** GitHub-only: no Codeberg milestone write path yet. */
    editable: boolean;
    metadataPromise: Promise<IssueMetadata>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export function MilestoneSection({
    provider,
    editable,
    metadataPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: MilestoneSectionProps) {
    const [operations, setOperations] = useState<MilestoneOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [metadataPromise]);

    const { data: repoMilestones } = api.pulls.listMilestones.useQuery(
        { provider, owner, repo },
        { enabled: editable },
    );
    const setMutation = api.pulls.setMilestone.useMutation();

    const milestonesData: RepoMilestone[] = repoMilestones ?? [];
    const handleSet = (milestone: IssueMilestone | null) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, milestone }]);
        setMutation.mutate(
            {
                owner,
                repo,
                number,
                // GitHub's write API takes the milestone number, which
                // IssueMilestone.id holds for GitHub.
                milestone: milestone ? Number(milestone.id) : null,
            },
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
                <h3 className="text-text-primary">Milestone</h3>
                {editable && (
                    <Async promise={metadataPromise} fallback={null}>
                        {(metadata) => (
                            <Async
                                promise={permissionContextPromise}
                                fallback={null}
                            >
                                {(permissionContext) => (
                                    <MilestoneSectionSettings
                                        repoMilestones={milestonesData}
                                        milestone={metadata.milestone}
                                        operations={operations}
                                        onSetMilestone={handleSet}
                                        disabled={!canEdit(permissionContext)}
                                    />
                                )}
                            </Async>
                        )}
                    </Async>
                )}
            </div>
            <Async
                promise={metadataPromise}
                fallback={
                    <div className="mt-2">
                        <FieldSkeleton />
                    </div>
                }
            >
                {(metadata) => (
                    <MilestoneSectionContent
                        milestone={metadata.milestone}
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
    repoMilestones: RepoMilestone[];
    milestone: IssueMilestone | null;
    operations: MilestoneOperation[];
    onSetMilestone: (milestone: IssueMilestone | null) => void;
    disabled?: boolean;
}) {
    const currentMilestone = applyOperations(milestone, operations);
    const currentId = currentMilestone?.id ?? null;

    return (
        <SearchableDropdown
            items={repoMilestones}
            isSelected={(m) => milestoneKey(m) === currentId}
            onSelect={(m) => {
                if (milestoneKey(m) !== currentId) {
                    onSetMilestone(toMilestone(m));
                }
            }}
            keyFn={(m) => milestoneKey(m)}
            searchFn={(m, q) => m.title.toLowerCase().includes(q)}
            renderItem={(m, selected) => (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-text-label">{m.title}</span>
                    {m.description && (
                        <span className="truncate text-text-muted text-xs">
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
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary",
                        currentId === null && "bg-blue-50 dark:bg-blue-950/30",
                    )}
                    onClick={() => {
                        if (currentId !== null) {
                            onSetMilestone(null);
                        }
                    }}
                    role="option"
                    aria-selected={currentId === null}
                >
                    <span className="flex-1 text-text-tertiary italic">
                        No milestone
                    </span>
                    {currentId === null && (
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
    milestone: IssueMilestone | null;
    operations: MilestoneOperation[];
}) {
    const currentMilestone = applyOperations(milestone, operations);

    if (!currentMilestone) {
        return <p className="text-sm text-text-tertiary">No milestone</p>;
    }

    return (
        <a
            className="text-sm text-text-secondary hover:underline"
            href={currentMilestone.htmlUrl}
            target="_blank"
            rel="noreferrer"
        >
            {currentMilestone.title}
        </a>
    );
}

function applyOperations(
    milestone: IssueMilestone | null,
    operations: MilestoneOperation[],
): IssueMilestone | null {
    let updatedMilestone = milestone;
    for (const op of operations) {
        updatedMilestone = op.milestone;
    }
    return updatedMilestone;
}
