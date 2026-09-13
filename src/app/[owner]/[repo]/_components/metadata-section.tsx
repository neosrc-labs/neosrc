import type {
    IssueGetResponseData,
    PullsGetResponseData,
} from "~/server/github";
import { AssigneeSection } from "./assignee-section";
import { LabelsSection } from "./label-section";
import { MilestoneSection } from "./milestone-section";
import type { PullRequestPermissionContext } from "./permissions-utils";
import { ReviewerSection } from "./reviewer-section";

interface MetadataSectionProps {
    pullRequestPromise: Promise<{
        labels: PullsGetResponseData["labels"] | IssueGetResponseData["labels"];
        assignees?: PullsGetResponseData["assignees"];
        milestone: PullsGetResponseData["milestone"];
    }>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
    showReviewers?: boolean;
}

export function MetadataSection({
    pullRequestPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
    showReviewers = true,
}: MetadataSectionProps) {
    return (
        <>
            {showReviewers && (
                <section>
                    <ReviewerSection
                        permissionContextPromise={permissionContextPromise}
                        // Sound: reviewers render only for pull requests, whose
                        // callers always supply the full PR payload.
                        pullRequestPromise={
                            pullRequestPromise as Promise<PullsGetResponseData>
                        }
                        owner={owner}
                        repo={repo}
                        number={number}
                    />
                </section>
            )}

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
