import { MetadataSection } from "~/app/[owner]/[repo]/_components/metadata-section";
import type { PullRequestPermissionContext } from "~/app/[owner]/[repo]/_components/permissions-utils";
import type { IssueGetResponseData } from "~/server/github";

interface IssueRightSidebarProps {
    issuePromise: Promise<IssueGetResponseData> | null;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export function IssueRightSidebar({
    issuePromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: IssueRightSidebarProps) {
    if (!issuePromise) {
        return (
            <aside
                className="border-border-subtle border-l bg-surface px-4 py-6"
                data-testid="right-sidebar"
            >
                <p className="text-sm text-text-tertiary">
                    No issue data available.
                </p>
            </aside>
        );
    }

    return (
        <aside
            className="flex h-full flex-col border-border-subtle border-l bg-surface px-4 py-6"
            data-testid="right-sidebar"
        >
            <div className="sticky top-0 z-10 space-y-4 bg-surface pb-4">
                <MetadataSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={issuePromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                    showReviewers={false}
                />
            </div>
        </aside>
    );
}
