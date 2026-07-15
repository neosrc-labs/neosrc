import { Circle, CircleCheck, GitPullRequest } from "lucide-react";

export function IssueEmptyState({
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
                    <p className="font-medium text-gray-900 dark:text-zinc-100">
                        No issues match your search
                    </p>
                    <p className="text-gray-500 text-sm dark:text-zinc-400">
                        Try a different search or clear filters
                    </p>
                </>
            ) : activeTab === "open" ? (
                <>
                    <CircleCheck className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-zinc-100">
                        No open issues
                    </p>
                </>
            ) : (
                <>
                    <Circle className="size-8 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-zinc-100">
                        No closed issues
                    </p>
                </>
            )}
        </div>
    );
}
