"use client";

import type { PullsGetResponseData } from "~/server/github";
import { AssigneeSection } from "./assignee-section";
import { LabelsSection } from "./label-section";
import { MilestoneSection } from "./milestone-section";
import { ReviewerSection } from "./reviewer-section";

interface MetadataSectionProps {
    pullRequestPromise: Promise<PullsGetResponseData>;
    userPermission: Promise<string | null>;
    owner: string;
    repo: string;
    number: number;
}

export function MetadataSection({
    pullRequestPromise,
    userPermission,
    owner,
    repo,
    number,
}: MetadataSectionProps) {
    return (
        <>
            {/* Reviewers Section */}
            <section>
                <ReviewerSection
                    userPermission={userPermission}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Assignees Section */}
            <section>
                <AssigneeSection
                    userPermission={userPermission}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Milestone Section */}
            <section>
                <MilestoneSection
                    userPermission={userPermission}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Labels Section */}
            <section className="min-h-30">
                <LabelsSection
                    userPermission={userPermission}
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
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
        </section>
    );
}
