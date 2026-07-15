"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

interface AutocompleteMatch {
    key: string;
    value: string;
}

export function detectQualifier(
    text: string,
    cursorPos: number,
    supportedQualifiers: string[],
): (AutocompleteMatch & { start: number; end: number }) | null {
    const textBeforeCursor = text.slice(0, cursorPos);
    const pattern = `(${supportedQualifiers.join(":|")}:)([\\w-]*)$`;
    const QUALIFIER_RE = new RegExp(pattern);
    const match = textBeforeCursor.match(QUALIFIER_RE);
    if (!match) return null;
    const key = (match[1] ?? "").slice(0, -1);
    const value = match[2] ?? "";
    const idx = match.index ?? 0;
    return {
        key,
        value,
        start: idx,
        end: idx + match[0].length,
    };
}

export function replaceQualifierValue(
    text: string,
    cursorPos: number,
    key: string,
    value: string,
): string {
    const detection = detectQualifier(
        text,
        cursorPos,
        Object.keys(STATIC_OPTIONS),
    );
    if (!detection) return text;
    const replacement = `${key}:${value.includes(" ") ? `"${value}"` : value}`;
    const prefix = text.slice(0, detection.start);
    const suffix = text.slice(detection.end);
    const spacer = prefix.length > 0 && !prefix.endsWith(" ") ? " " : "";
    return `${prefix}${spacer}${replacement} ${suffix}`;
}

interface Suggestion {
    label: string;
    subtitle?: string;
    color?: string;
    avatarUrl?: string;
    name?: string;
}

export interface SearchAutocompleteHandle {
    handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: used as a default fallback
const STATIC_OPTIONS: Record<string, any> = {};

export const SearchAutocomplete = forwardRef<
    SearchAutocompleteHandle,
    {
        owner: string;
        repo: string;
        provider?: "gh" | "cb";
        match: AutocompleteMatch;
        query: string;
        staticOptions?: Record<string, { label: string; subtitle?: string }[]>;
        onSelect: (key: string, value: string) => void;
        onClose: () => void;
    }
>(function SearchAutocomplete(
    {
        owner,
        repo,
        provider = "gh",
        match,
        query,
        staticOptions = STATIC_OPTIONS,
        onSelect,
        onClose,
    },
    ref,
) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const { data: labels } = api.pulls.listLabels.useQuery(
        { provider, owner, repo },
        { enabled: match.key === "label" },
    );

    const { data: assignees } = api.pulls.listAssignees.useQuery(
        { provider, owner, repo },
        { enabled: match.key === "assignee" || match.key === "author" },
    );
    const { data: recentAuthors } = api.pulls.listRecentAuthors.useQuery(
        { provider, owner, repo },
        { enabled: match.key === "author" },
    );
    const { data: currentUser } = api.users.currentUser.useQuery();

    const allUsers = useMemo(() => {
        if (match.key !== "author" && match.key !== "assignee") return [];
        const map = new Map<
            string,
            { login: string; name?: string | null; avatar_url?: string }
        >();
        for (const u of assignees ?? []) {
            map.set(u.login, u);
        }
        if (match.key === "author") {
            for (const u of recentAuthors ?? []) {
                if (!map.has(u.login)) {
                    map.set(u.login, u);
                }
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
    }, [
        match.key,
        assignees,
        recentAuthors,
        currentUser?.login,
        currentUser?.avatarUrl,
    ]);

    const suggestions = useMemo((): Suggestion[] => {
        const q = query.toLowerCase();

        if (match.key === "label") {
            return (labels ?? [])
                .filter((l: { name: string }) =>
                    l.name.toLowerCase().includes(q),
                )
                .map(
                    (l: {
                        name: string;
                        color: string;
                        description?: string | null;
                    }) => ({
                        label: l.name,
                        subtitle: l.description ?? undefined,
                        color: l.color,
                    }),
                );
        }

        if (match.key === "author" || match.key === "assignee") {
            const filtered = allUsers.filter((u) =>
                u.login.toLowerCase().includes(q),
            );
            const result: Suggestion[] = filtered.map((u) => ({
                label: u.login,
                name: u.name ?? undefined,
                avatarUrl: u.avatar_url,
            }));
            if (
                q.length > 0 &&
                !result.some((r) => r.label.toLowerCase() === q)
            ) {
                result.push({
                    label: q,
                    subtitle: "Search for this user",
                });
            }
            return result;
        }

        const options = staticOptions[match.key];
        if (options) {
            return options.filter((o: { label: string }) =>
                o.label.toLowerCase().includes(q),
            );
        }

        return [];
    }, [match.key, query, labels, allUsers, staticOptions]);

    const prevCountRef = useRef(suggestions.length);
    if (prevCountRef.current !== suggestions.length) {
        prevCountRef.current = suggestions.length;
        setSelectedIndex(0);
    }

    useEffect(() => {
        const el = listRef.current?.children[selectedIndex] as
            | HTMLElement
            | undefined;
        el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const handleSelect = useCallback(
        (suggestion: Suggestion) => {
            const value = suggestion.label.includes(" ")
                ? `"${suggestion.label}"`
                : suggestion.label;
            onSelect(match.key, value);
        },
        [match.key, onSelect],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (suggestions.length === 0) return false;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => (i + 1) % suggestions.length);
                return true;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(
                    (i) => (i - 1 + suggestions.length) % suggestions.length,
                );
                return true;
            }
            if (e.key === "Enter" && suggestions[selectedIndex]) {
                e.preventDefault();
                const suggestion = suggestions[selectedIndex];
                if (suggestion) {
                    handleSelect(suggestion);
                }
                return true;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return true;
            }
            return false;
        },
        [suggestions, selectedIndex, handleSelect, onClose],
    );

    useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown]);

    if (suggestions.length === 0) return null;

    return (
        <div
            ref={listRef}
            className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-border bg-surface-elevated shadow-lg"
        >
            <ul className="max-h-60 overflow-y-auto py-1">
                {suggestions.map((suggestion, i) => (
                    <li
                        key={suggestion.label}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary ${
                            i === selectedIndex ? "bg-surface-tertiary" : ""
                        }`}
                        onClick={() => handleSelect(suggestion)}
                        onMouseEnter={() => setSelectedIndex(i)}
                    >
                        {suggestion.color ? (
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                <Label
                                    color={suggestion.color}
                                    className="shrink-0"
                                >
                                    {suggestion.label}
                                </Label>
                                {suggestion.subtitle && (
                                    <span className="truncate text-text-muted text-xs">
                                        {suggestion.subtitle}
                                    </span>
                                )}
                            </span>
                        ) : suggestion.avatarUrl ? (
                            <img
                                src={suggestion.avatarUrl}
                                alt=""
                                className="size-5 shrink-0 rounded-full"
                            />
                        ) : null}
                        {!suggestion.color && (
                            <span className="flex min-w-0 flex-1 flex-col text-left">
                                {suggestion.name ? (
                                    <>
                                        <span className="truncate font-medium text-sm text-text-primary">
                                            {suggestion.name}
                                        </span>
                                        <span className="truncate text-text-tertiary text-xs">
                                            {suggestion.label}
                                        </span>
                                    </>
                                ) : (
                                    <span className="truncate text-sm text-text-primary">
                                        {suggestion.subtitle ??
                                            suggestion.label}
                                    </span>
                                )}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
});
