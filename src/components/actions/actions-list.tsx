"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Pagination } from "~/components/ui/pagination";
import {
    ACTIONS_CAPABILITIES,
    type ActionsFilterKey,
    isWorkflowRunStatus,
    WORKFLOW_RUNS_PER_PAGE,
} from "~/server/api/routers/actions/types";
import { api } from "~/trpc/react";
import { formatCount } from "~/utils/helpers";
import { eventLabel, statusLabel } from "./actions-display";
import { ActionsEmptyState } from "./actions-empty-state";
import type { ActionsFilterOption } from "./actions-filter-dropdown";
import { ActionsToolbar } from "./actions-toolbar";
import { WorkflowRunRow } from "./workflow-run-row";
import { WorkflowRunSkeleton } from "./workflow-run-skeleton";
import { WorkflowSidebar } from "./workflow-sidebar";

export function ActionsList({
    provider,
    owner,
    repo,
}: {
    provider: "gh" | "cb";
    owner: string;
    repo: string;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const baseRoute = `/${provider}/${owner}/${repo}/actions`;

    const workflow = searchParams.get("workflow");
    const branch = searchParams.get("branch");
    const actor = searchParams.get("actor");
    const event = searchParams.get("event");
    // Unknown status values are ignored rather than rejected, so a hand-edited
    // URL shows unfiltered runs instead of a validation error. Same shape as
    // the sort/order normalization in use-search-list.
    const statusParam = searchParams.get("status");
    const status =
        statusParam && isWorkflowRunStatus(statusParam) ? statusParam : null;
    const page = Math.max(
        1,
        Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );

    // A provider only offers the filters it applies, so a stale query param it
    // cannot honour is dropped instead of failing the request.
    const { filters: supportedFilters } = ACTIONS_CAPABILITIES[provider];
    const applied = <T extends string>(
        key: ActionsFilterKey,
        value: T | null,
    ) => (supportedFilters.includes(key) ? (value ?? undefined) : undefined);
    const activeFilters = {
        workflow: applied("workflow", workflow),
        branch: applied("branch", branch),
        actor: applied("actor", actor),
        event: applied("event", event),
        status: applied("status", status),
    };

    const navigate = useCallback(
        (changes: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams);
            for (const [key, value] of Object.entries(changes)) {
                if (value === null) {
                    params.delete(key);
                } else {
                    params.set(key, value);
                }
            }
            const query = params.toString();
            router.push(query ? `${baseRoute}?${query}` : baseRoute);
        },
        [baseRoute, router, searchParams],
    );

    const runsQuery = api.actions.listWorkflowRuns.useQuery({
        provider,
        owner,
        repo,
        workflow: activeFilters.workflow,
        branch: activeFilters.branch,
        actor: activeFilters.actor,
        event: activeFilters.event,
        status: activeFilters.status,
        page,
    });
    const workflowsQuery = api.actions.listWorkflows.useQuery({
        provider,
        owner,
        repo,
    });
    const filterOptionsQuery = api.actions.getFilterOptions.useQuery({
        provider,
        owner,
        repo,
    });

    const workflows = workflowsQuery.data;
    const filterOptions = filterOptionsQuery.data;
    const items = runsQuery.data?.items ?? [];
    const totalCount = runsQuery.data?.totalCount ?? 0;

    const workflowOptions: ActionsFilterOption[] = (workflows ?? []).map(
        (item) => ({ value: item.id, label: item.name }),
    );
    const eventOptions: ActionsFilterOption[] = (
        filterOptions?.events ?? []
    ).map((value) => ({ value, label: eventLabel(value) }));
    const statusOptions: ActionsFilterOption[] = (
        filterOptions?.statuses ?? []
    ).map((value) => ({ value, label: statusLabel(value) }));
    const branchOptions: ActionsFilterOption[] = (
        filterOptions?.branches ?? []
    ).map((value) => ({ value, label: value }));
    const actorOptions: ActionsFilterOption[] = (
        filterOptions?.actors ?? []
    ).map((option) => ({
        value: option.login,
        label: option.login,
        avatarUrl: option.avatarUrl,
    }));
    const selectedWorkflow =
        workflows?.find((item) => item.id === workflow) ?? null;
    // A provider whose catalogue comes from recent runs may not know the
    // filtered workflow; the raw value still names it.
    const selectedWorkflowName = selectedWorkflow?.name ?? workflow;
    const hasFilters = Object.values(activeFilters).some(Boolean);
    const filterOptionsLoading =
        workflowsQuery.isLoading || filterOptionsQuery.isLoading;

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <WorkflowSidebar
                provider={provider}
                owner={owner}
                repo={repo}
                workflows={workflows ?? []}
                selectedWorkflowId={workflow}
                isLoading={workflowsQuery.isLoading}
                onSelectWorkflow={(id) =>
                    navigate({
                        workflow: id === "" ? null : id,
                        page: null,
                    })
                }
            />

            <div className="min-w-0 flex-1">
                <div className="pb-4">
                    <h2 className="font-semibold text-lg text-text-primary">
                        {selectedWorkflowName ?? "All workflows"}
                    </h2>
                    <p className="text-sm text-text-muted">
                        {`Showing runs from ${selectedWorkflowName ?? "all workflows"}`}
                        {totalCount > 0
                            ? ` · ${formatCount(totalCount)} workflow runs`
                            : ""}
                    </p>
                </div>

                <ActionsToolbar
                    filters={supportedFilters}
                    workflowOptions={workflowOptions}
                    eventOptions={eventOptions}
                    statusOptions={statusOptions}
                    branchOptions={branchOptions}
                    actorOptions={actorOptions}
                    selectedWorkflow={workflow}
                    selectedEvent={event}
                    selectedBranch={branch}
                    selectedActor={actor}
                    selectedStatus={status}
                    isLoading={filterOptionsLoading}
                    onSelect={(key, value) =>
                        navigate({ [key]: value, page: null })
                    }
                />

                <div className="border-border-subtle border-t">
                    {runsQuery.isLoading ? (
                        <WorkflowRunSkeleton />
                    ) : runsQuery.isError ? (
                        <p className="px-4 py-8 text-center text-red-600 text-sm">
                            Failed to load workflow runs.
                        </p>
                    ) : items.length === 0 ? (
                        <ActionsEmptyState filtered={hasFilters} />
                    ) : (
                        items.map((run) => (
                            <WorkflowRunRow
                                key={run.id}
                                run={run}
                                provider={provider}
                                owner={owner}
                                repo={repo}
                            />
                        ))
                    )}
                </div>

                <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(totalCount / WORKFLOW_RUNS_PER_PAGE)}
                    onPageChange={(nextPage) =>
                        navigate({ page: String(nextPage) })
                    }
                />
            </div>
        </div>
    );
}
