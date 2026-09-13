"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, opId } from "~/lib/utils";
import type { IssueMetadata } from "~/server/api/routers/issues/types";
import type { Assignee } from "~/server/api/routers/mappers";
import { api } from "~/trpc/react";
import { domain, type Provider } from "~/utils/provider-url";
import { FieldSkeleton } from "./metadata-section";
import {
    canEdit,
    type PullRequestPermissionContext,
} from "./permissions-utils";

type AssigneeOperation = {
    id: number;
    op: "add" | "remove";
    assignee: Assignee;
};

// Repo assignee list payload (REST snake_case); both providers fit.
type RepoAssignee = { login: string; avatar_url: string };

const toAssignee = (a: RepoAssignee): Assignee => ({
    login: a.login,
    avatarUrl: a.avatar_url,
});

interface AssigneeSectionProps {
    provider: Provider;
    /** GitHub-only: no Codeberg assignee write path yet. */
    editable: boolean;
    metadataPromise: Promise<IssueMetadata>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export function AssigneeSection({
    provider,
    editable,
    metadataPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: AssigneeSectionProps) {
    const [operations, setOperations] = useState<AssigneeOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [metadataPromise]);

    const { data: repoAssignees } = api.pulls.listAssignees.useQuery(
        { provider, owner, repo },
        { enabled: editable },
    );
    const assigneesData: RepoAssignee[] = repoAssignees ?? [];
    const addMutation = api.pulls.addAssignee.useMutation();
    const removeMutation = api.pulls.removeAssignee.useMutation();

    const handleAdd = (assignee: Assignee) => {
        const repoAssignee = assigneesData.find(
            (a) => a.login === assignee.login,
        );
        if (!repoAssignee) return;

        const id = opId();
        setOperations((prev) => [...prev, { id, op: "add", assignee }]);
        addMutation.mutate(
            { owner, repo, number, assignee: assignee.login },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id !== id));
                },
            },
        );
    };

    const handleRemove = (assignee: Assignee) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, op: "remove", assignee }]);
        removeMutation.mutate(
            { owner, repo, number, assignee: assignee.login },
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
                <h3 className="text-text-primary">Assignees</h3>
                {editable && (
                    <Async promise={metadataPromise} fallback={null}>
                        {(metadata) => (
                            <Async
                                promise={permissionContextPromise}
                                fallback={null}
                            >
                                {(permissionContext) => (
                                    <AssigneeSectionSettings
                                        repoAssignees={assigneesData}
                                        assignees={metadata.assignees}
                                        operations={operations}
                                        onAddAssignee={handleAdd}
                                        onRemoveAssignee={handleRemove}
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
                            <AssigneeSectionContent
                                provider={provider}
                                assignees={metadata.assignees}
                                operations={operations}
                                onRemoveAssignee={handleRemove}
                                canEdit={editable && canEdit(permissionContext)}
                            />
                        )}
                    </Async>
                )}
            </Async>
        </>
    );
}

function AssigneeSectionSettings({
    repoAssignees,
    assignees,
    operations,
    onAddAssignee,
    onRemoveAssignee,
    disabled,
}: {
    repoAssignees: RepoAssignee[];
    assignees: Assignee[];
    operations: AssigneeOperation[];
    onAddAssignee: (assignee: Assignee) => void;
    onRemoveAssignee: (assignee: Assignee) => void;
    disabled?: boolean;
}) {
    const displayAssignees = applyOperations(assignees, operations);
    const currentLogins = new Set(displayAssignees.map((a) => a.login));

    return (
        <SearchableDropdown
            items={repoAssignees}
            isSelected={(a) => currentLogins.has(a.login)}
            onSelect={(a) =>
                currentLogins.has(a.login)
                    ? onRemoveAssignee(toAssignee(a))
                    : onAddAssignee(toAssignee(a))
            }
            keyFn={(a) => a.login}
            searchFn={(a, q) => a.login.toLowerCase().includes(q)}
            renderItem={(a, selected) => (
                <>
                    <Image
                        src={a.avatar_url}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full"
                        width={20}
                        height={20}
                    />
                    <span className="flex-1 truncate text-text-label">
                        {a.login}
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
            ariaLabel="Manage assignees"
            disabled={disabled}
        />
    );
}

function AssigneeSectionContent({
    provider,
    assignees,
    operations,
    onRemoveAssignee,
    canEdit,
}: {
    provider: Provider;
    assignees: Assignee[];
    operations: AssigneeOperation[];
    onRemoveAssignee: (assignee: Assignee) => void;
    canEdit: boolean;
}) {
    const displayAssignees = applyOperations(assignees, operations);

    if (displayAssignees.length === 0) {
        return <p className="text-sm text-text-tertiary">No assignees</p>;
    }

    return (
        <ul className="space-y-2">
            {displayAssignees.map((assignee) => (
                <li
                    className="group flex items-center gap-2 text-sm"
                    key={assignee.login}
                >
                    <UserHoverCard login={assignee.login} provider={provider}>
                        <a
                            className="flex items-center gap-2"
                            href={`https://${domain(provider)}/${assignee.login}`}
                        >
                            <Image
                                alt={assignee.login}
                                className="h-5 w-5 rounded-full"
                                src={assignee.avatarUrl}
                                width={20}
                                height={20}
                            />
                            <span className="text-text-secondary">
                                {assignee.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    {canEdit && (
                        <button
                            className="ml-auto inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-text-muted opacity-0 hover:text-text-secondary group-hover:opacity-100 dark:hover:text-zinc-300"
                            onClick={() => onRemoveAssignee(assignee)}
                            type="button"
                            aria-label={`Remove ${assignee.login}`}
                        >
                            &times;
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

function applyOperations(
    assignees: Assignee[],
    operations: AssigneeOperation[],
): Assignee[] {
    return applyArrayOperations(
        assignees,
        operations,
        (op) => op.assignee,
        (a) => a.login,
    );
}
