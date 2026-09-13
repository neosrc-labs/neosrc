"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ListSkeleton } from "~/app/[owner]/[repo]/_components/list/list-skeleton";
import { Pagination } from "~/components/ui/pagination";
import { formatCount } from "~/lib/utils";
import { WORKFLOW_RUNS_PER_PAGE } from "~/server/api/routers/actions/types";
import { api } from "~/trpc/react";
import { eventLabel } from "./actions-display";
import { ActionsEmptyState } from "./actions-empty-state";
import type { ActionsFilterOption } from "./actions-filter-dropdown";
import { ActionsToolbar } from "./actions-toolbar";
import { WorkflowRunRow } from "./workflow-run-row";
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
    const status = searchParams.get("status");
    const page = Math.max(
        1,
        Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );

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
        workflow: workflow ?? undefined,
        branch: branch ?? undefined,
        actor: actor ?? undefined,
        event: event ?? undefined,
        status: status ?? undefined,
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
        (item) => ({ value: String(item.id), label: item.name }),
    );
    const eventOptions: ActionsFilterOption[] = (
        filterOptions?.events ?? []
    ).map((value) => ({ value, label: eventLabel(value) }));
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
        workflows?.find((item) => String(item.id) === workflow) ?? null;
    const selectedWorkflowName = selectedWorkflow?.name ?? null;
    const hasFilters = Boolean(workflow || branch || actor || event || status);
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
                    workflowOptions={workflowOptions}
                    eventOptions={eventOptions}
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
                        <ListSkeleton />
                    ) : runsQuery.isError ? (
                        <p className="px-4 py-8 text-center text-red-600 text-sm">
                            Failed to load workflow runs.
                        </p>
                    ) : items.length === 0 ? (
                        <ActionsEmptyState filtered={hasFilters} />
                    ) : (
                        items.map((run) => (
                            <WorkflowRunRow key={run.id} run={run} />
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
