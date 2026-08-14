"use client";

import { ChevronDown, Tag } from "lucide-react";
import { useState } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";
import {
    labelDropdownProps,
    selectedLabelNames,
} from "./label-dropdown-options";

export function LabelDropdown({
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
    onToggle: (labelName: string) => void;
}) {
    const [enabled, setEnabled] = useState(false);

    const { data: labels, isLoading } = api.pulls.listLabels.useQuery(
        { provider, owner, repo },
        { enabled },
    );

    const items = labels ?? [];
    const currentNames = selectedLabelNames(items, currentQuery);

    return (
        <SearchableDropdown
            {...labelDropdownProps({
                items,
                isLoading,
                currentNames,
                ariaLabel: "Filter by label",
                onSelect: (l) => onToggle(l.name),
                onOpenChange: (open) => {
                    if (open) setEnabled(true);
                },
            })}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                >
                    <Tag className="size-4" />
                    Label
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
