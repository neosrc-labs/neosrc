"use client";

import { ChevronDown, User, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";
import { useDebounce } from "./use-debounce";
import {
    buildUserOptions,
    selectedUserNames,
    userDropdownProps,
} from "./user-dropdown-options";

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

    const allUsers = buildUserOptions({
        assignees,
        recentAuthors,
        includeRecentAuthors: true,
        currentUser,
    });

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

    const selectedNames = selectedUserNames(allUsers, currentQuery, "author");

    const selectedUser = useMemo(
        () =>
            selectedAuthor
                ? allUsers.find((u) => u.login === selectedAuthor)
                : undefined,
        [allUsers, selectedAuthor],
    );

    return (
        <SearchableDropdown
            {...userDropdownProps({
                items: allItems,
                isLoading,
                selectedNames,
                qualifierKey: "author",
                ariaLabel: "Filter by author",
                onToggle,
                onOpenChange: (open) => {
                    if (open) setEnabled(true);
                },
                onSearchChange: setSearchText,
            })}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    {selectedUser ? (
                        <>
                            {selectedUser.avatar_url ? (
                                <Image
                                    src={selectedUser.avatar_url}
                                    alt=""
                                    className="size-4 shrink-0 rounded-full"
                                    width={16}
                                    height={16}
                                />
                            ) : null}
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
