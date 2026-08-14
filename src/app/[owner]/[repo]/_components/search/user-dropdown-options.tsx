"use client";

import Image from "next/image";

export interface UserOption {
    login: string;
    name?: string | null;
    avatar_url?: string;
}

export function buildUserOptions({
    assignees,
    recentAuthors,
    includeRecentAuthors,
    currentUser,
}: {
    assignees?: Array<{
        login: string;
        name?: string | null;
        avatar_url?: string | null;
    }>;
    recentAuthors?: Array<{
        login: string;
        name?: string | null;
        avatar_url?: string | null;
    }>;
    includeRecentAuthors?: boolean;
    currentUser?: { login?: string | null; avatarUrl?: string | null } | null;
}): UserOption[] {
    const map = new Map<string, UserOption>();
    for (const u of assignees ?? []) {
        map.set(u.login, {
            login: u.login,
            name: u.name ?? undefined,
            avatar_url: u.avatar_url ?? undefined,
        });
    }
    if (includeRecentAuthors) {
        for (const u of recentAuthors ?? []) {
            if (!map.has(u.login)) {
                map.set(u.login, {
                    login: u.login,
                    name: u.name ?? undefined,
                    avatar_url: u.avatar_url ?? undefined,
                });
            }
        }
    }
    if (currentUser?.login && !map.has(currentUser.login)) {
        map.set(currentUser.login, {
            login: currentUser.login,
            avatar_url: currentUser.avatarUrl ?? undefined,
        });
    }
    const result = Array.from(map.values());
    result.sort((a, b) => {
        if (a.login === currentUser?.login) return -1;
        if (b.login === currentUser?.login) return 1;
        return a.login.localeCompare(b.login);
    });
    return result;
}

export function selectedUserNames(
    users: UserOption[],
    currentQuery: string,
    qualifierKey: string,
): Set<string> {
    return new Set(
        users
            .filter((u) => currentQuery.includes(`${qualifierKey}:${u.login}`))
            .map((u) => u.login),
    );
}

export function userDropdownProps({
    items,
    isLoading,
    selectedNames,
    qualifierKey,
    ariaLabel,
    onToggle,
    onOpenChange,
    onSearchChange,
}: {
    items: UserOption[];
    isLoading: boolean;
    selectedNames: Set<string>;
    qualifierKey: string;
    ariaLabel: string;
    onToggle: (key: string, value: string) => void;
    onOpenChange?: (open: boolean) => void;
    onSearchChange?: (query: string) => void;
}) {
    return {
        items,
        isLoading,
        isSelected: (u: UserOption) => selectedNames.has(u.login),
        onSelect: (u: UserOption) => onToggle(qualifierKey, u.login),
        keyFn: (u: UserOption) => u.login,
        searchFn: (u: UserOption, q: string) =>
            u.login.toLowerCase().includes(q.toLowerCase()),
        renderItem: (u: UserOption, selected: boolean) => (
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {u.avatar_url ? (
                    <Image
                        src={u.avatar_url}
                        alt=""
                        className="size-5 shrink-0 rounded-full"
                        width={20}
                        height={20}
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
        ),
        placeholder: "Filter users...",
        emptyText: "No users found",
        ariaLabel,
        onOpenChange,
        closeOnSelect: true,
        onSearchChange,
    };
}
