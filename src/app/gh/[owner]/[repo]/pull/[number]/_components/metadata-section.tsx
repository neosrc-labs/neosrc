"use client";

import type { ReactNode } from "react";
import { Async } from "~/components/async";
import type { PullsGetResponseData } from "~/server/github";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { AssigneeSection } from "./assignee-section";
import { LabelsSection } from "./label-section";
import { MilestoneSection } from "./milestone-section";
import { ReviewerSection } from "./reviewer-section";

interface MetadataSectionProps {
    pullRequestPromise: Promise<PullsGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export type { MetadataSectionProps };

/**
 * onError option for optimistic section mutations: drop the failed operation
 * from the local operation log so the UI rolls back to the server state.
 */
export function mutationRollback<T extends { id: number }>(
    id: number,
    setOperations: (updater: (prev: T[]) => T[]) => void,
) {
    return {
        onError: () =>
            setOperations((prev) => prev.filter((op) => op.id !== id)),
    };
}

export function MetadataSection({
    pullRequestPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: MetadataSectionProps) {
    return (
        <>
            {/* Reviewers Section */}
            <section>
                <ReviewerSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Assignees Section */}
            <section>
                <AssigneeSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Milestone Section */}
            <section>
                <MilestoneSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Labels Section */}
            <section className="min-h-30">
                <LabelsSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>
        </>
    );
}

export function FieldSkeleton() {
    return (
        <section>
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-surface-selected" />
        </section>
    );
}

/**
 * Resolves the pull request + permission context promises for a metadata
 * section's content, showing a skeleton while the pull request loads.
 */
export function SectionContentFrame({
    pullRequestPromise,
    permissionContextPromise,
    children,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    children: (data: {
        pullRequest: PullsGetResponseData;
        permissionContext: PullRequestPermissionContext;
    }) => ReactNode;
}) {
    return (
        <Async
            promise={pullRequestPromise}
            fallback={
                <div className="mt-2">
                    <FieldSkeleton />
                </div>
            }
        >
            {(pullRequest) => (
                <Async promise={permissionContextPromise} fallback={null}>
                    {(permissionContext) =>
                        children({ pullRequest, permissionContext })
                    }
                </Async>
            )}
        </Async>
    );
}

/**
 * Resolves the pull request + permission context promises for a metadata
 * section's header row (title + settings controls).
 */
export function SectionHeaderFrame({
    title,
    pullRequestPromise,
    permissionContextPromise,
    children,
}: {
    title: string;
    pullRequestPromise: Promise<PullsGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    children: (data: {
        pullRequest: PullsGetResponseData;
        permissionContext: PullRequestPermissionContext;
    }) => ReactNode;
}) {
    return (
        <div className="flex items-start justify-between">
            <h3 className="text-text-primary">{title}</h3>
            <Async promise={pullRequestPromise} fallback={null}>
                {(pullRequest) => (
                    <Async promise={permissionContextPromise} fallback={null}>
                        {(permissionContext) =>
                            children({ pullRequest, permissionContext })
                        }
                    </Async>
                )}
            </Async>
        </div>
    );
}
