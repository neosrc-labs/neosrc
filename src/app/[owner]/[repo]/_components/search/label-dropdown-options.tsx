"use client";

import { Label as LabelComponent } from "~/components/ui/label";

/** A label-shaped item rendered inside the label search dropdowns. */
export interface LabelOption {
    name: string;
    color: string;
    description?: string | null;
}

/** Names of `items` currently selected in `query` via `label:name`. */
export function selectedLabelNames(
    items: LabelOption[],
    currentQuery: string,
): Set<string> {
    return new Set(
        items
            .filter((l) => currentQuery.includes(`label:${l.name}`))
            .map((l) => l.name),
    );
}

/** Shared SearchableDropdown props for label items. */
export function labelDropdownProps<TItem extends LabelOption>({
    items,
    isLoading,
    currentNames,
    ariaLabel,
    onSelect,
    onOpenChange,
    disabled,
}: {
    items: TItem[];
    isLoading?: boolean;
    currentNames: Set<string>;
    ariaLabel: string;
    onSelect: (label: TItem) => void;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
}) {
    return {
        items,
        isLoading,
        isSelected: (l: TItem) => currentNames.has(l.name),
        onSelect,
        keyFn: (l: TItem) => l.name,
        searchFn: (l: TItem, q: string) =>
            l.name.toLowerCase().includes(q.toLowerCase()),
        renderItem: (l: TItem, selected: boolean) => (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <LabelComponent
                        color={l.color}
                        description={l.description ?? undefined}
                    >
                        {l.name}
                    </LabelComponent>
                    {selected && (
                        <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
                {l.description && (
                    <span className="truncate text-text-muted text-xs">
                        {l.description}
                    </span>
                )}
            </div>
        ),
        placeholder: "Filter labels",
        emptyText: "No labels found",
        ariaLabel,
        onOpenChange,
        disabled,
    };
}
