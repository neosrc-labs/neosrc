"use client";

import { ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";
import {
    buildUserOptions,
    selectedUserNames,
    userDropdownProps,
} from "./user-dropdown-options";

export function AssigneeDropdown({
    owner,
    repo,
    provider = "gh",
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    provider?: "gh" | "cb";
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const [enabled, setEnabled] = useState(false);

    const { data: assignees, isLoading: assigneesLoading } =
        api.pulls.listAssignees.useQuery(
            { provider, owner, repo },
            { enabled },
        );
    const { data: currentUser, isLoading: currentUserLoading } =
        api.users.currentUser.useQuery(undefined, {
            enabled,
        });
    const isLoading = assigneesLoading || currentUserLoading;

    const allUsers = buildUserOptions({ assignees, currentUser });

    const selectedNames = selectedUserNames(allUsers, currentQuery, "assignee");

    return (
        <SearchableDropdown
            {...userDropdownProps({
                items: allUsers,
                isLoading,
                selectedNames,
                qualifierKey: "assignee",
                ariaLabel: "Filter by assignee",
                onToggle,
                onOpenChange: (open) => {
                    if (open) setEnabled(true);
                },
            })}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    <User className="size-4" />
                    Assignee
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
