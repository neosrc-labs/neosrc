"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import type { RepoWorkflowItem } from "~/server/api/routers/actions/types";
import { domain } from "~/utils/provider-url";

const SIDEBAR_WORKFLOW_LIMIT = 10;

const SHIMMER_ROWS = ["s1", "s2", "s3", "s4", "s5", "s6"];

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="px-3 pt-2 pb-1 font-semibold text-text-muted text-xs uppercase tracking-wide">
            {children}
        </h3>
    );
}

function SidebarItem({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            className={cn(
                "block w-full truncate rounded-md px-3 py-1.5 text-left text-sm",
                active
                    ? "bg-surface-tertiary font-medium text-text-primary"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
            )}
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    );
}

export function WorkflowSidebar({
    provider,
    owner,
    repo,
    workflows,
    selectedWorkflowId,
    isLoading,
    onSelectWorkflow,
}: {
    provider: "gh" | "cb";
    owner: string;
    repo: string;
    workflows: RepoWorkflowItem[];
    selectedWorkflowId: string | null;
    isLoading: boolean;
    onSelectWorkflow: (workflowId: string) => void;
}) {
    const [showMore, setShowMore] = useState(false);

    const providerDomain = domain(provider);
    const visibleWorkflows = showMore
        ? workflows
        : workflows.slice(0, SIDEBAR_WORKFLOW_LIMIT);

    return (
        <aside className="w-full shrink-0 lg:w-64">
            <SectionTitle>Workflows</SectionTitle>
            {isLoading ? (
                <div className="space-y-1 px-3 py-1">
                    {SHIMMER_ROWS.map((id) => (
                        <div
                            className="h-6 animate-pulse rounded bg-surface-selected"
                            key={id}
                        />
                    ))}
                </div>
            ) : (
                <>
                    <SidebarItem
                        active={selectedWorkflowId === null}
                        onClick={() => onSelectWorkflow("")}
                    >
                        All workflows
                    </SidebarItem>
                    {visibleWorkflows.map((workflow) => (
                        <SidebarItem
                            active={selectedWorkflowId === String(workflow.id)}
                            key={workflow.id}
                            onClick={() =>
                                onSelectWorkflow(String(workflow.id))
                            }
                        >
                            {workflow.name}
                        </SidebarItem>
                    ))}
                    {!showMore && workflows.length > SIDEBAR_WORKFLOW_LIMIT && (
                        <button
                            className="block w-full truncate rounded-md px-3 py-1.5 text-left text-sm text-text-muted hover:bg-surface-tertiary hover:text-text-secondary"
                            onClick={() => setShowMore(true)}
                            type="button"
                        >
                            Show more workflows...
                        </button>
                    )}
                </>
            )}

            <SectionTitle>Management</SectionTitle>
            <a
                className="block truncate rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                href={`https://${providerDomain}/${owner}/${repo}/actions/caches`}
                target="_blank"
                rel="noreferrer"
            >
                Caches
            </a>
            <a
                className="block truncate rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                href={`https://${providerDomain}/${owner}/${repo}/deployments`}
                target="_blank"
                rel="noreferrer"
            >
                Deployments
            </a>
        </aside>
    );
}
