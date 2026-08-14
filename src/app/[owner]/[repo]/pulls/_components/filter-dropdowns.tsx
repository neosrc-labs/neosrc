"use client";

import { ChevronDown, CircleCheck, Eye } from "lucide-react";
import { hasQualifier } from "~/app/[owner]/[repo]/_components/search/search-utils";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";

function filterDropdownProps({
    options,
    qualifierKey,
    currentQuery,
    onToggle,
    placeholder,
    emptyText,
    ariaLabel,
    displaySubtitle = false,
}: {
    options: { label: string; subtitle: string }[];
    qualifierKey: string;
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
    placeholder: string;
    emptyText: string;
    ariaLabel: string;
    displaySubtitle?: boolean;
}) {
    return {
        items: options,
        isSelected: (o: { label: string }) =>
            hasQualifier(currentQuery, qualifierKey, o.label),
        onSelect: (o: { label: string }) => onToggle(qualifierKey, o.label),
        keyFn: (o: { label: string }) => o.label,
        searchFn: (o: { label: string }, q: string) =>
            o.label.toLowerCase().includes(q.toLowerCase()),
        renderItem: (
            o: { label: string; subtitle: string },
            selected: boolean,
        ) => (
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">
                    {displaySubtitle ? (o.subtitle ?? o.label) : o.label}
                </span>
                {selected && (
                    <span className="ml-auto shrink-0 text-blue-600 text-xs dark:text-blue-400">
                        &#10003;
                    </span>
                )}
            </div>
        ),
        placeholder,
        emptyText,
        ariaLabel,
        closeOnSelect: true,
    };
}

export function StatusFilterDropdown({
    currentQuery,
    onToggle,
}: {
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const STATUS_OPTIONS = [
        { label: "pending", subtitle: "Pending" },
        { label: "success", subtitle: "Success" },
        { label: "failure", subtitle: "Failure" },
    ];

    return (
        <SearchableDropdown
            {...filterDropdownProps({
                options: STATUS_OPTIONS,
                qualifierKey: "status",
                currentQuery,
                onToggle,
                placeholder: "Filter status...",
                emptyText: "No status options",
                ariaLabel: "Filter by status",
            })}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    <CircleCheck className="size-4" />
                    Checks
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}

export function ReviewFilterDropdown({
    currentQuery,
    onToggle,
}: {
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const REVIEW_OPTIONS = [
        { label: "none", subtitle: "Not reviewed" },
        { label: "required", subtitle: "Review required" },
        { label: "approved", subtitle: "Approved" },
        { label: "changes_requested", subtitle: "Changes requested" },
    ];

    return (
        <SearchableDropdown
            {...filterDropdownProps({
                options: REVIEW_OPTIONS,
                qualifierKey: "review",
                currentQuery,
                onToggle,
                placeholder: "Filter review...",
                emptyText: "No review options",
                ariaLabel: "Filter by review",
                displaySubtitle: true,
            })}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    <Eye className="size-4" />
                    Review
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
