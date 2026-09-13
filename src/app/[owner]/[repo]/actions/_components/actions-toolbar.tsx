"use client";

import { WORKFLOW_RUN_STATUS_OPTIONS } from "./actions-display";
import type { ActionsFilterOption } from "./actions-filter-dropdown";
import { ActionsFilterDropdown } from "./actions-filter-dropdown";

const STATUS_OPTIONS: ActionsFilterOption[] = WORKFLOW_RUN_STATUS_OPTIONS.map(
    (option) => ({ value: option.value, label: option.label }),
);

export function ActionsToolbar({
    workflowOptions,
    eventOptions,
    branchOptions,
    actorOptions,
    selectedWorkflow,
    selectedEvent,
    selectedBranch,
    selectedActor,
    selectedStatus,
    isLoading,
    onSelect,
}: {
    workflowOptions: ActionsFilterOption[];
    eventOptions: ActionsFilterOption[];
    branchOptions: ActionsFilterOption[];
    actorOptions: ActionsFilterOption[];
    selectedWorkflow: string | null;
    selectedEvent: string | null;
    selectedBranch: string | null;
    selectedActor: string | null;
    selectedStatus: string | null;
    isLoading: boolean;
    onSelect: (
        key: "workflow" | "event" | "branch" | "actor" | "status",
        value: string | null,
    ) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1 border-border-subtle border-b py-3">
            <ActionsFilterDropdown
                label="Workflow"
                options={workflowOptions}
                selectedValue={selectedWorkflow}
                onSelect={(value) => onSelect("workflow", value)}
                isLoading={isLoading}
            />
            <ActionsFilterDropdown
                label="Event"
                options={eventOptions}
                selectedValue={selectedEvent}
                onSelect={(value) => onSelect("event", value)}
                isLoading={isLoading}
            />
            <ActionsFilterDropdown
                label="Status"
                options={STATUS_OPTIONS}
                selectedValue={selectedStatus}
                onSelect={(value) => onSelect("status", value)}
            />
            <ActionsFilterDropdown
                label="Branch"
                options={branchOptions}
                selectedValue={selectedBranch}
                onSelect={(value) => onSelect("branch", value)}
                isLoading={isLoading}
            />
            <ActionsFilterDropdown
                label="Actor"
                options={actorOptions}
                selectedValue={selectedActor}
                onSelect={(value) => onSelect("actor", value)}
                isLoading={isLoading}
            />
        </div>
    );
}
