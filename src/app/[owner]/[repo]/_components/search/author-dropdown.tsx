"use client";

import { ChevronDown, User } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";
import { useDebounce } from "./use-debounce";

export function AuthorDropdown({
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
    const { data: recentAuthors } = api.pulls.listRecentAuthors.useQuery({
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
        for (const u of recentAuthors ?? []) {
            if (!map.has(u.login)) {
                map.set(u.login, u);
            }
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
    }, [assignees, recentAuthors, currentUser?.login, currentUser?.avatarUrl]);

    const [searchText, setSearchText] = useState("");
    const debouncedSearch = useDebounce(searchText, 300);

    const filtered = useMemo(
        () =>
            allUsers.filter(
                (u) =>
                    u.login.toLowerCase().includes(searchText.toLowerCase()) &&
                    !currentQuery.includes(`author:${u.login}`),
            ),
        [allUsers, searchText, currentQuery],
    );

    const isCustomAuthor =
        debouncedSearch.length > 0 &&
        !filtered.some(
            (u) => u.login.toLowerCase() === debouncedSearch.toLowerCase(),
        );

    const { data: searchedUserRaw, isFetched: userSearchDone } =
        api.users.getByUsername.useQuery(
            { username: debouncedSearch, provider },
            { enabled: isCustomAuthor, retry: false },
        );
    const searchedUser = (
        searchedUserRaw as { user?: { avatar_url?: string } } | undefined
    )?.user;
    const userNotFound = isCustomAuthor && userSearchDone && !searchedUser;

    const customAuthorItem =
        isCustomAuthor && !userNotFound
            ? [
                  {
                      login: debouncedSearch,
                      avatar_url: searchedUser?.avatar_url ?? "",
                      isCustom: true as const,
                  },
              ]
            : [];

    const allItems = [...filtered, ...customAuthorItem];

    const selectedNames = new Set(
        allUsers
            .filter((u) => currentQuery.includes(`author:${u.login}`))
            .map((u) => u.login),
    );

    return (
        <SearchableDropdown
            items={allItems}
            isSelected={(u: { login: string }) => selectedNames.has(u.login)}
            onSelect={(u: { login: string }) => onToggle("author", u.login)}
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
            emptyText={
                isCustomAuthor && userNotFound
                    ? "No users found"
                    : "No users found"
            }
            ariaLabel="Filter by author"
            closeOnSelect
            onSearchChange={setSearchText}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    <User className="size-4" />
                    Author
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
