"use client";

import { ChevronDown, User, X } from "lucide-react";
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
    selectedAuthor,
}: {
    owner: string;
    repo: string;
    provider?: "gh" | "cb";
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
    selectedAuthor?: string;
}) {
    const [enabled, setEnabled] = useState(false);

    const { data: assignees, isLoading: assigneesLoading } =
        api.pulls.listAssignees.useQuery(
            { provider, owner, repo },
            { enabled },
        );

    const { data: recentAuthors, isLoading: recentAuthorsLoading } =
        api.pulls.listRecentAuthors.useQuery(
            { provider, owner, repo },
            { enabled },
        );

    const { data: currentUser, isLoading: currentUserLoading } =
        api.users.currentUser.useQuery(undefined, { enabled });
    const isLoading =
        assigneesLoading || recentAuthorsLoading || currentUserLoading;

    const allUsers = useMemo(() => {
        const seen = new Set<string>();
        const users: { login: string; avatar_url?: string }[] = [];
        const add = (
            u: { login: string; avatar_url?: string | null } | null | undefined,
        ) => {
            if (!u || seen.has(u.login)) return;
            seen.add(u.login);
            users.push({
                login: u.login,
                avatar_url: u.avatar_url ?? undefined,
            });
        };
        (assignees ?? []).forEach(add);
        (recentAuthors ?? []).forEach(add);
        if (currentUser?.login) {
            const login = currentUser.login;
            add({
                login,
                avatar_url: currentUser.avatarUrl ?? undefined,
            });
        }
        return users;
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
                      avatar_url: searchedUser?.avatar_url,
                  },
              ]
            : [];

    const allItems = [...filtered, ...customAuthorItem];

    const selectedNames = new Set(
        allUsers
            .filter((u) => currentQuery.includes(`author:${u.login}`))
            .map((u) => u.login),
    );

    const selectedUser = useMemo(
        () =>
            selectedAuthor
                ? allUsers.find((u) => u.login === selectedAuthor)
                : undefined,
        [allUsers, selectedAuthor],
    );

    return (
        <SearchableDropdown
            items={allItems}
            isLoading={isLoading}
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
            onOpenChange={(open) => {
                if (open) setEnabled(true);
            }}
            closeOnSelect
            onSearchChange={setSearchText}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    {selectedUser ? (
                        <>
                            <img
                                src={selectedUser.avatar_url}
                                alt=""
                                className="size-4 shrink-0 rounded-full"
                            />
                            <span>{selectedUser.login}</span>
                            <button
                                type="button"
                                className="ml-0.5 inline-flex cursor-pointer items-center rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
                                aria-label="Clear author filter"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle("author", selectedUser.login);
                                }}
                            >
                                <X className="size-3" />
                            </button>
                        </>
                    ) : (
                        <>
                            <User className="size-4" />
                            Author
                        </>
                    )}
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
