import { MetadataSection } from "~/app/[owner]/[repo]/_components/metadata-section";
import type { PullRequestPermissionContext } from "~/app/[owner]/[repo]/_components/permissions-utils";
import type { IssueMetadata } from "~/server/api/routers/issues/types";
import type { Provider } from "~/utils/provider-url";

interface IssueRightSidebarProps {
    provider: Provider;
    editable: boolean;
    metadataPromise: Promise<IssueMetadata> | null;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

export function IssueRightSidebar({
    provider,
    editable,
    metadataPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: IssueRightSidebarProps) {
    if (!metadataPromise) {
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
                    provider={provider}
                    editable={editable}
                    metadataPromise={metadataPromise}
                    permissionContextPromise={permissionContextPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                    showReviewers={false}
                />
            </div>
        </aside>
    );
}
