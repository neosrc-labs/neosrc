"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, opId } from "~/lib/utils";
import type { Assignee } from "~/server/github";
import { api } from "~/trpc/react";
import { canEdit } from "../permissions-utils";
import {
    type MetadataSectionProps,
    mutationRollback,
    SectionContentFrame,
    SectionHeaderFrame,
} from "./metadata-section";

type AssigneeOperation = {
    id: number;
    op: "add" | "remove";
    assignee: Assignee;
};

export function AssigneeSection({
    pullRequestPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: MetadataSectionProps) {
    const [operations, setOperations] = useState<AssigneeOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [pullRequestPromise]);

    const { data: repoAssignees } = api.pulls.listAssignees.useQuery({
        provider: "gh",
        owner,
        repo,
    });
    const assigneesData = (repoAssignees ?? []) as Assignee[];
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
            mutationRollback(id, setOperations),
        );
    };

    const handleRemove = (assignee: Assignee) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, op: "remove", assignee }]);
        removeMutation.mutate(
            { owner, repo, number, assignee: assignee.login },
            mutationRollback(id, setOperations),
        );
    };

    return (
        <>
            <SectionHeaderFrame
                title="Assignees"
                pullRequestPromise={pullRequestPromise}
                permissionContextPromise={permissionContextPromise}
            >
                {({ pullRequest, permissionContext }) => (
                    <AssigneeSectionSettings
                        repoAssignees={assigneesData}
                        assignees={pullRequest.assignees ?? []}
                        operations={operations}
                        onAddAssignee={handleAdd}
                        onRemoveAssignee={handleRemove}
                        disabled={!canEdit(permissionContext)}
                    />
                )}
            </SectionHeaderFrame>
            <SectionContentFrame
                pullRequestPromise={pullRequestPromise}
                permissionContextPromise={permissionContextPromise}
            >
                {({ pullRequest, permissionContext }) => (
                    <AssigneeSectionContent
                        assignees={pullRequest.assignees ?? []}
                        operations={operations}
                        onRemoveAssignee={handleRemove}
                        canEdit={canEdit(permissionContext)}
                    />
                )}
            </SectionContentFrame>
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
    repoAssignees: Assignee[];
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
                    ? onRemoveAssignee(a)
                    : onAddAssignee(a)
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
    assignees,
    operations,
    onRemoveAssignee,
    canEdit,
}: {
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
                    <UserHoverCard login={assignee.login}>
                        <a
                            className="flex items-center gap-2"
                            href={assignee.html_url}
                        >
                            <Image
                                alt={assignee.login}
                                className="h-5 w-5 rounded-full"
                                src={assignee.avatar_url}
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
