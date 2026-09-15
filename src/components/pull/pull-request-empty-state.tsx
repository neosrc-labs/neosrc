import { GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";

export function PullRequestEmptyState({
    searchQuery,
    activeTab,
}: {
    searchQuery: string;
    activeTab: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            {searchQuery ? (
                <>
                    <GitPullRequest className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No pull requests match your search
                    </p>
                    <p className="text-sm text-text-tertiary">
                        Try a different search or clear filters
                    </p>
                </>
            ) : activeTab === "open" ? (
                <>
                    <GitPullRequest className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No open pull requests
                    </p>
                </>
            ) : activeTab === "closed" ? (
                <>
                    <GitPullRequestClosed className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No closed pull requests
                    </p>
                </>
            ) : (
                <>
                    <GitMerge className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No merged pull requests
                    </p>
                </>
            )}
        </div>
    );
}
