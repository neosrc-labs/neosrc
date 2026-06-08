"use client";

import { ChevronDown, Tag } from "lucide-react";
import { Label as LabelComponent } from "~/components/ui/label";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";

export function LabelDropdown({
    owner,
    repo,
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    currentQuery: string;
    onToggle: (labelName: string) => void;
}) {
    const { data: labels } = api.pulls.listLabels.useQuery({ owner, repo });

    const items = labels ?? [];
    const currentNames = new Set(
        items
            .filter((l: { name: string }) =>
                currentQuery.includes(`label:${l.name}`),
            )
            .map((l: { name: string }) => l.name),
    );

    return (
        <SearchableDropdown
            items={items}
            isSelected={(l: { name: string }) => currentNames.has(l.name)}
            onSelect={(l: { name: string }) => onToggle(l.name)}
            keyFn={(l: { name: string }) => l.name}
            searchFn={(l: { name: string }, q: string) =>
                l.name.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                l: {
                    name: string;
                    color: string;
                    description?: string | null;
                },
                selected: boolean,
            ) => (
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
                        <span className="truncate text-gray-400 text-xs">
                            {l.description}
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter labels"
            emptyText="No labels found"
            ariaLabel="Filter by label"
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <Tag className="size-4" />
                    Label
                    <ChevronDown className="size-3.5 text-gray-400" />
                </button>
            }
        />
    );
}
