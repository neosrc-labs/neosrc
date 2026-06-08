"use client";

import { ChevronDown, User } from "lucide-react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";

export function AssigneeDropdown({
    owner,
    repo,
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const { data: users } = api.pulls.listAssignees.useQuery({ owner, repo });

    const selectedNames = new Set(
        (users ?? [])
            .filter((u: { login: string }) =>
                currentQuery.includes(`assignee:${u.login}`),
            )
            .map((u: { login: string }) => u.login),
    );

    return (
        <SearchableDropdown
            items={users ?? []}
            isSelected={(u: { login: string }) => selectedNames.has(u.login)}
            onSelect={(u: { login: string }) => onToggle("assignee", u.login)}
            keyFn={(u: { login: string }) => u.login}
            searchFn={(u: { login: string }, q: string) =>
                u.login.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                u: { login: string; avatar_url?: string },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {u.avatar_url ? (
                        <img
                            src={u.avatar_url}
                            alt=""
                            className="size-5 shrink-0 rounded-full"
                        />
                    ) : (
                        <div className="size-5 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-700" />
                    )}
                    <span className="truncate">{u.login}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter users..."
            emptyText="No users found"
            ariaLabel="Filter by assignee"
            closeOnSelect
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <User className="size-4" />
                    Assignee
                    <ChevronDown className="size-3.5 text-gray-400" />
                </button>
            }
        />
    );
}
