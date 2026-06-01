"use client";

import { useEffect, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { applyArrayOperations, opId } from "~/lib/utils";
import type { Assignee, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type AssigneeOperation = {
    id: number;
    op: "add" | "remove";
    assignee: Assignee;
};

export function AssigneeSection({
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
    const [operations, setOperations] = useState<AssigneeOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [pullRequestPromise]);

    const { data: repoAssignees } = api.pulls.listAssignees.useQuery({
        owner,
        repo,
    });
    const addMutation = api.pulls.addAssignee.useMutation();
    const removeMutation = api.pulls.removeAssignee.useMutation();

    const assigneesData = repoAssignees ?? [];
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
                <h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
                    Assignees
                </h3>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <Async promise={userPermission} fallback={null}>
                            {(permission) => (
                                <AssigneeSectionSettings
                                    repoAssignees={assigneesData}
                                    assignees={pullRequest.assignees ?? []}
                                    operations={operations}
                                    onAddAssignee={handleAdd}
                                    onRemoveAssignee={handleRemove}
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
                    <Async promise={userPermission} fallback={null}>
                        {(permission) => (
                            <AssigneeSectionContent
                                assignees={pullRequest.assignees ?? []}
                                operations={operations}
                                onRemoveAssignee={handleRemove}
                                canEdit={
                                    permission === "admin" ||
                                    permission === "write"
                                }
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
                    <img
                        src={a.avatar_url}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full"
                    />
                    <span className="flex-1 truncate text-gray-700 dark:text-zinc-300">
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
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No assignees
            </p>
        );
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
                            <img
                                alt={assignee.login}
                                className="h-5 w-5 rounded-full"
                                src={assignee.avatar_url}
                            />
                            <span className="text-gray-600 dark:text-zinc-400">
                                {assignee.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    {canEdit && (
                        <button
                            className="ml-auto inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-400 opacity-0 hover:text-gray-600 group-hover:opacity-100 dark:hover:text-zinc-300"
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
