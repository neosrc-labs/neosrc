import { GitBranch } from "lucide-react";

export function BranchEmptyState({
    searchQuery,
    activeTab,
}: {
    searchQuery: string;
    activeTab: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <GitBranch className="size-8 text-text-muted" />
            {searchQuery ? (
                <>
                    <p className="font-medium text-text-primary">
                        No branches match your search
                    </p>
                    <p className="text-sm text-text-tertiary">
                        Try a different search or clear filters
                    </p>
                </>
            ) : (
                <p className="font-medium text-text-primary">
                    {activeTab === "stale"
                        ? "No stale branches"
                        : activeTab === "active"
                          ? "No active branches"
                          : "No branches"}
                </p>
            )}
        </div>
    );
}
