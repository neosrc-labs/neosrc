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
                    <GitPullRequest className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                        No pull requests match your search
                    </p>
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                        Try a different search or clear filters
                    </p>
                </>
            ) : activeTab === "open" ? (
                <>
                    <GitPullRequest className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                        No open pull requests
                    </p>
                </>
            ) : activeTab === "closed" ? (
                <>
                    <GitPullRequestClosed className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                        No closed pull requests
                    </p>
                </>
            ) : (
                <>
                    <GitMerge className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                        No merged pull requests
                    </p>
                </>
            )}
        </div>
    );
}
