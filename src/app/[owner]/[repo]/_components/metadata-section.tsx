import type { IssueMetadata } from "~/server/api/routers/issues/types";
import type { PullsGetResponseData } from "~/server/github";
import type { Provider } from "~/utils/provider-url";
import { AssigneeSection } from "./assignee-section";
import { LabelsSection } from "./label-section";
import { MilestoneSection } from "./milestone-section";
import type { PullRequestPermissionContext } from "./permissions-utils";
import { ReviewerSection } from "./reviewer-section";

interface MetadataSectionProps {
    provider: Provider;
    /** GitHub-only: no Codeberg write path for labels/assignees/milestones yet. */
    editable?: boolean;
    metadataPromise: Promise<IssueMetadata>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
    showReviewers?: boolean;
    /** PR-only: reviewers render from the full pull request payload. */
    reviewerPayloadPromise?: Promise<PullsGetResponseData>;
}

export function MetadataSection({
    provider,
    editable = true,
    metadataPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
    showReviewers = true,
    reviewerPayloadPromise,
}: MetadataSectionProps) {
    return (
        <>
            {showReviewers && reviewerPayloadPromise && (
                <section>
                    <ReviewerSection
                        permissionContextPromise={permissionContextPromise}
                        pullRequestPromise={reviewerPayloadPromise}
                        owner={owner}
                        repo={repo}
                        number={number}
                    />
                </section>
            )}

            {/* Assignees Section */}
            <section>
                <AssigneeSection
                    provider={provider}
                    editable={editable}
                    metadataPromise={metadataPromise}
                    permissionContextPromise={permissionContextPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Milestone Section */}
            <section>
                <MilestoneSection
                    provider={provider}
                    editable={editable}
                    metadataPromise={metadataPromise}
                    permissionContextPromise={permissionContextPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            </section>

            {/* Labels Section */}
            <section className="min-h-30">
                <LabelsSection
                    provider={provider}
                    editable={editable}
                    metadataPromise={metadataPromise}
                    permissionContextPromise={permissionContextPromise}
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
