"use client";

import { ChevronDown, User } from "lucide-react";
import { useMemo } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";

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
    const { data: assignees } = api.pulls.listAssignees.useQuery({
        provider,
        owner,
        repo,
    });
    const { data: currentUser } = api.users.currentUser.useQuery();

    const allUsers = useMemo(() => {
        const map = new Map<string, { login: string; avatar_url?: string }>();
        for (const u of assignees ?? []) {
            map.set(u.login, u);
        }
        if (currentUser?.login && !map.has(currentUser.login)) {
            map.set(currentUser.login, {
                login: currentUser.login,
                avatar_url: currentUser.avatarUrl,
            });
        }
        const result = Array.from(map.values());
        result.sort((a, b) => {
            if (a.login === currentUser?.login) return -1;
            if (b.login === currentUser?.login) return 1;
            return a.login.localeCompare(b.login);
        });
        return result;
    }, [assignees, currentUser?.login, currentUser?.avatarUrl]);

    const selectedNames = new Set(
        allUsers
            .filter((u) => currentQuery.includes(`assignee:${u.login}`))
            .map((u) => u.login),
    );

    return (
        <SearchableDropdown
            items={allUsers}
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
                        <div className="size-5 shrink-0 rounded-full bg-surface-selected" />
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
