"use client";

import { User } from "lucide-react";
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
    key: "author" | "label" | "assignee";
    value: string;
}

const QUALIFIER_RE = /(author:|label:|assignee:)([\w-]*)$/;

export function detectQualifier(
    text: string,
    cursorPos: number,
): (AutocompleteMatch & { start: number; end: number }) | null {
    const textBeforeCursor = text.slice(0, cursorPos);
    // First find the qualifier in text before cursor
    const match = textBeforeCursor.match(QUALIFIER_RE);
    if (!match) return null;
    const key = (match[1] ?? "").slice(0, -1) as AutocompleteMatch["key"];
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
    const detection = detectQualifier(text, cursorPos);
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

export const SearchAutocomplete = forwardRef<
    SearchAutocompleteHandle,
    {
        owner: string;
        repo: string;
        match: AutocompleteMatch;
        query: string;
        onSelect: (key: string, value: string) => void;
        onClose: () => void;
    }
>(function SearchAutocomplete(
    { owner, repo, match, query, onSelect, onClose },
    ref,
) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const { data: labels } = api.pulls.listLabels.useQuery(
        { owner, repo },
        { enabled: match.key === "label" },
    );

    const { data: assignees } = api.pulls.listAssignees.useQuery(
        { owner, repo },
        { enabled: match.key === "assignee" || match.key === "author" },
    );

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
            const filtered = (assignees ?? []).filter((u: { login: string }) =>
                u.login.toLowerCase().includes(q),
            );
            const result: Suggestion[] = filtered.map(
                (u: {
                    login: string;
                    name?: string | null;
                    avatar_url?: string;
                }) => ({
                    label: u.login,
                    name: u.name ?? undefined,
                    avatarUrl: u.avatar_url,
                }),
            );
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

        return [];
    }, [match.key, query, labels, assignees]);

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
            className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
            <ul className="max-h-60 overflow-y-auto py-1">
                {suggestions.map((suggestion, i) => (
                    <li
                        key={suggestion.label}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                            i === selectedIndex
                                ? "bg-gray-100 dark:bg-zinc-800"
                                : ""
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
                                    <span className="truncate text-gray-400 text-xs dark:text-gray-500">
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
                        ) : (
                            <User className="size-4 shrink-0 text-gray-400" />
                        )}
                        {!suggestion.color && (
                            <span className="flex min-w-0 flex-1 flex-col text-left">
                                {suggestion.name ? (
                                    <>
                                        <span className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
                                            {suggestion.name}
                                        </span>
                                        <span className="truncate text-gray-500 text-xs dark:text-gray-400">
                                            {suggestion.label}
                                        </span>
                                    </>
                                ) : (
                                    <span className="truncate text-gray-900 text-sm dark:text-gray-100">
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
