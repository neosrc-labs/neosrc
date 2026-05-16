"use client";

import { useEffect, useRef } from "react";

interface IssueItem {
    number: number;
    title: string;
    type: "issue" | "pull_request";
    user: { login: string } | null;
}

interface IssueAutocompleteProps {
    issues: IssueItem[];
    loading: boolean;
    error: string | null;
    selectedIndex: number;
    onSelect: (issueNumber: number) => void;
    style?: React.CSSProperties;
}

export function IssueAutocomplete({
    issues,
    loading,
    error,
    selectedIndex,
    onSelect,
    style,
}: IssueAutocompleteProps) {
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (listRef.current && selectedIndex >= 0) {
            const item = listRef.current.children[selectedIndex] as
                | HTMLElement
                | undefined;
            item?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    if (loading) {
        return (
            <div
                className="absolute z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                data-autocomplete="true"
                style={style}
            >
                <div className="px-3 py-2 text-gray-500 text-sm dark:text-gray-400">
                    Loading...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="absolute z-50 w-96 rounded-lg border border-red-200 bg-white shadow-lg dark:border-red-800 dark:bg-zinc-900"
                data-autocomplete="true"
                style={style}
            >
                <div className="px-3 py-2 text-red-600 text-sm dark:text-red-400">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (issues.length === 0) {
        return (
            <div
                className="absolute z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                data-autocomplete="true"
                style={style}
            >
                <div className="px-3 py-2 text-gray-500 text-sm dark:text-gray-400">
                    No issues found
                </div>
            </div>
        );
    }

    return (
        <div
            className="absolute z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            data-autocomplete="true"
            style={style}
        >
            <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
                {issues.map((issue: IssueItem, index: number) => (
                    <li
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                            index === selectedIndex
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800"
                        }`}
                        key={issue.number}
                        onClick={() => onSelect(issue.number)}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {issue.type === "pull_request" ? (
                            <svg
                                className="shrink-0 text-green-600 dark:text-green-400"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                            >
                                <title>Pull request</title>
                                <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                            </svg>
                        ) : (
                            <svg
                                className="shrink-0 text-blue-600 dark:text-blue-400"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                            >
                                <title>Issue</title>
                                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                            </svg>
                        )}
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                            #{issue.number}
                        </span>{" "}
                        {issue.title}
                    </li>
                ))}
            </ul>
        </div>
    );
}
