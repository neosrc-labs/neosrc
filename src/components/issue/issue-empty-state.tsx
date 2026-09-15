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
                    <GitPullRequest className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No issues match your search
                    </p>
                    <p className="text-sm text-text-tertiary">
                        Try a different search or clear filters
                    </p>
                </>
            ) : activeTab === "open" ? (
                <>
                    <CircleCheck className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No open issues
                    </p>
                </>
            ) : (
                <>
                    <Circle className="size-8 text-text-muted" />
                    <p className="font-medium text-text-primary">
                        No closed issues
                    </p>
                </>
            )}
        </div>
    );
}
