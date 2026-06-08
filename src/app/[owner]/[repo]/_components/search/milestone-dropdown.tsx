"use client";

import { ChevronDown, Flag } from "lucide-react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { api } from "~/trpc/react";

export function MilestoneDropdown({
    owner,
    repo,
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    currentQuery: string;
    onToggle: (milestone: string) => void;
}) {
    const { data: milestones } = api.pulls.listMilestones.useQuery({
        owner,
        repo,
    });

    const items = milestones ?? [];
    const currentNames = new Set(
        items
            .filter((m: { title: string }) =>
                currentQuery.includes(`milestone:"${m.title}"`),
            )
            .map((m: { title: string }) => m.title),
    );

    return (
        <SearchableDropdown
            items={items}
            isSelected={(m: { title: string }) => currentNames.has(m.title)}
            onSelect={(m: { title: string }) => onToggle(m.title)}
            keyFn={(m: { title: string }) => m.title}
            searchFn={(m: { title: string }, q: string) =>
                m.title.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                m: {
                    title: string;
                    description?: string | null;
                    open_issues?: number;
                    closed_issues?: number;
                },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{m.title}</span>
                        {selected && (
                            <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                                &#10003;
                            </span>
                        )}
                    </div>
                    {m.description && (
                        <span className="truncate text-gray-400 text-xs">
                            {m.description}
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter milestones"
            emptyText="No milestones found"
            ariaLabel="Filter by milestone"
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <Flag className="size-4" />
                    Milestone
                    <ChevronDown className="size-3.5 text-gray-400" />
                </button>
            }
        />
    );
}
