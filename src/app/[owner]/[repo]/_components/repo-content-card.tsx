import type { ReactNode } from "react";

/**
 * Bordered card wrapping a repo listing, a file body or their skeletons, so
 * every view of a repo's contents shares one piece of chrome.
 */
export function RepoContentCard({ children }: { children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {children}
        </div>
    );
}
