"use client";

import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { Label as LabelComponent } from "~/components/ui/label";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, opId } from "~/lib/utils";
import type { IssueMetadata } from "~/server/api/routers/issues/types";
import type { Label } from "~/server/api/routers/mappers";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";
import { FieldSkeleton } from "./metadata-section";
import {
    canEdit,
    type PullRequestPermissionContext,
} from "./permissions-utils";

type LabelOperation = { id: number; op: "add" | "remove"; label: Label };

// Repo label list payload; both providers carry these fields.
type RepoLabel = {
    id?: number;
    name: string;
    color: string;
    description: string | null;
};

const toLabel = (l: RepoLabel): Label => ({
    id: String(l.id ?? ""),
    name: l.name,
    color: l.color,
    description: l.description,
});

interface LabelsSectionProps {
    provider: Provider;
    /** GitHub-only: no Codeberg label write path yet. */
    editable: boolean;
    metadataPromise: Promise<IssueMetadata>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export function LabelsSection({
    provider,
    editable,
    metadataPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: LabelsSectionProps) {
    // We use a list of operations made by the user to track the UI state.
    // Instead of trying to sync the state with the server constantly, which is quite difficult,
    // we just take the initial labels and apply the operation log to it.
    // This allows us to optimistically update and handle users adding multiple in quick succession without racing on the server response.
    const [operations, setOperations] = useState<LabelOperation[]>([]);

    // If we reload the payload we should remove all operations the user made
    // and assume the new data is the latest.
    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [metadataPromise]);

    const { data: repoLabels } = api.pulls.listLabels.useQuery(
        { provider, owner, repo },
        { enabled: editable },
    );
    const addMutation = api.pulls.addLabel.useMutation();
    const removeMutation = api.pulls.removeLabel.useMutation();

    const labelsData: RepoLabel[] = repoLabels ?? [];
    const handleAdd = (label: Label) => {
        const repoLabel = labelsData.find((l) => l.name === label.name);
        if (!repoLabel) return;

        const id = opId();
        setOperations((prev) => [...prev, { id, op: "add", label }]);
        addMutation.mutate(
            { owner, repo, number, label: label.name },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id !== id));
                },
            },
        );
    };

    const handleRemove = (label: Label) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, op: "remove", label }]);
        removeMutation.mutate(
            { owner, repo, number, label: label.name },
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
                <h3 className="text-text-primary">Labels</h3>
                {editable && (
                    <Async promise={metadataPromise} fallback={null}>
                        {(metadata) => (
                            <Async
                                promise={permissionContextPromise}
                                fallback={null}
                            >
                                {(permissionContext) => (
                                    <LabelSectionSettings
                                        repoLabels={labelsData}
                                        labels={metadata.labels}
                                        operations={operations}
                                        onAddLabel={handleAdd}
                                        onRemoveLabel={handleRemove}
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
                    <Async promise={permissionContextPromise} fallback={null}>
                        {(permissionContext) => (
                            <LabelSectionContent
                                labels={metadata.labels}
                                operations={operations}
                                onRemoveLabel={handleRemove}
                                canEdit={editable && canEdit(permissionContext)}
                            />
                        )}
                    </Async>
                )}
            </Async>
        </>
    );
}

function LabelSectionSettings({
    repoLabels,
    labels,
    operations,
    onAddLabel,
    onRemoveLabel,
    disabled,
}: {
    repoLabels: RepoLabel[];
    labels: Label[];
    operations: LabelOperation[];
    onAddLabel: (label: Label) => void;
    onRemoveLabel: (label: Label) => void;
    disabled?: boolean;
}) {
    const displayLabels = applyOperations(labels, operations);
    const currentNames = new Set(displayLabels.map((l) => l.name));

    return (
        <SearchableDropdown
            items={repoLabels}
            isSelected={(l) => currentNames.has(l.name)}
            onSelect={(l) =>
                currentNames.has(l.name)
                    ? onRemoveLabel(toLabel(l))
                    : onAddLabel(toLabel(l))
            }
            keyFn={(l) => l.name}
            searchFn={(l, q) => l.name.toLowerCase().includes(q)}
            renderItem={(l, selected) => (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <LabelComponent
                            color={l.color}
                            description={l.description ?? undefined}
                        >
                            {l.name}
                        </LabelComponent>
                        {selected && (
                            <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                                &#10003;
                            </span>
                        )}
                    </div>
                    {l.description && (
                        <span className="truncate text-text-muted text-xs">
                            {l.description}
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter labels"
            emptyText="No labels found"
            ariaLabel="Manage labels"
            disabled={disabled}
        />
    );
}

function LabelSectionContent({
    labels,
    operations,
    onRemoveLabel,
    canEdit,
}: {
    labels: Label[];
    operations: LabelOperation[];
    onRemoveLabel: (label: Label) => void;
    canEdit: boolean;
}) {
    const displayLabels = applyOperations(labels, operations).sort((a, b) =>
        a.name.localeCompare(b.name),
    );

    if (displayLabels.length === 0) {
        return <p className="text-sm text-text-tertiary">No labels</p>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {displayLabels.map((label) => (
                <div key={label.name}>
                    <LabelComponent
                        color={label.color}
                        description={label.description ?? undefined}
                    >
                        {label.name}
                        {canEdit && (
                            <button
                                className="-mr-0.5 ml-0.5 inline-flex h-3 w-3 cursor-pointer items-center justify-center rounded-full text-current text-lg opacity-60 hover:opacity-100"
                                onClick={() => onRemoveLabel(label)}
                                type="button"
                                aria-label={`Remove label ${label.name}`}
                            >
                                &times;
                            </button>
                        )}
                    </LabelComponent>
                </div>
            ))}
        </div>
    );
}

function applyOperations(
    labels: Label[],
    operations: LabelOperation[],
): Label[] {
    return applyArrayOperations(
        labels,
        operations,
        (op) => op.label,
        (l) => l.name,
    );
}
