import type { LucideIcon } from "lucide-react";
import { GitPullRequest } from "lucide-react";

export function ListEmptyState({
    searchQuery,
    activeTab,
    itemName,
    tabs,
}: {
    searchQuery: string;
    activeTab: string;
    itemName: string;
    tabs: { key: string; label: string; icon: LucideIcon }[];
}) {
    if (searchQuery) {
        return (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <GitPullRequest className="size-8 text-text-muted" />
                <p className="font-medium text-text-primary">
                    No {itemName} match your search
                </p>
                <p className="text-sm text-text-tertiary">
                    Try a different search or clear filters
                </p>
            </div>
        );
    }

    const tab = tabs.find((t) => t.key === activeTab);
    if (!tab) return null;
    const Icon = tab.icon;
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Icon className="size-8 text-text-muted" />
            <p className="font-medium text-text-primary">
                No {tab.label.toLowerCase()} {itemName}
            </p>
        </div>
    );
}
