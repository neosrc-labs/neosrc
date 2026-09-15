"use client";

import type { ActionsFilterKey } from "~/server/api/routers/actions/types";
import type { ActionsFilterOption } from "./actions-filter-dropdown";
import { ActionsFilterDropdown } from "./actions-filter-dropdown";

export function ActionsToolbar({
    filters,
    workflowOptions,
    eventOptions,
    statusOptions,
    branchOptions,
    actorOptions,
    selectedWorkflow,
    selectedEvent,
    selectedStatus,
    selectedBranch,
    selectedActor,
    isLoading,
    onSelect,
}: {
    /** Filters the provider applies; the others are not offered. */
    filters: readonly ActionsFilterKey[];
    workflowOptions: ActionsFilterOption[];
    eventOptions: ActionsFilterOption[];
    statusOptions: ActionsFilterOption[];
    branchOptions: ActionsFilterOption[];
    actorOptions: ActionsFilterOption[];
    selectedWorkflow: string | null;
    selectedEvent: string | null;
    selectedStatus: string | null;
    selectedBranch: string | null;
    selectedActor: string | null;
    isLoading: boolean;
    onSelect: (key: ActionsFilterKey, value: string | null) => void;
}) {
    const dropdowns: {
        key: ActionsFilterKey;
        label: string;
        options: ActionsFilterOption[];
        selected: string | null;
    }[] = [
        {
            key: "workflow",
            label: "Workflow",
            options: workflowOptions,
            selected: selectedWorkflow,
        },
        {
            key: "event",
            label: "Event",
            options: eventOptions,
            selected: selectedEvent,
        },
        {
            key: "status",
            label: "Status",
            options: statusOptions,
            selected: selectedStatus,
        },
        {
            key: "branch",
            label: "Branch",
            options: branchOptions,
            selected: selectedBranch,
        },
        {
            key: "actor",
            label: "Actor",
            options: actorOptions,
            selected: selectedActor,
        },
    ];

    return (
        <div className="flex flex-wrap items-center gap-1 border-border-subtle border-b py-3">
            {dropdowns
                .filter((dropdown) => filters.includes(dropdown.key))
                .map((dropdown) => (
                    <ActionsFilterDropdown
                        key={dropdown.key}
                        label={dropdown.label}
                        options={dropdown.options}
                        selectedValue={dropdown.selected}
                        onSelect={(value) => onSelect(dropdown.key, value)}
                        isLoading={isLoading}
                    />
                ))}
        </div>
    );
}
