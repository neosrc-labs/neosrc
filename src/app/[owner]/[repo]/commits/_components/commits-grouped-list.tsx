"use client";

import type { CommitListItem } from "~/server/api/routers/commits/types";
import { CommitRow } from "./commit-row";

interface CommitsGroupedListProps {
    groupedCommits: Array<[string, CommitListItem[]]>;
    owner: string;
    repo: string;
    provider: "gh" | "cb";
    showStatus: boolean;
}

export function CommitsGroupedList({
    groupedCommits,
    owner,
    repo,
    provider,
    showStatus,
}: CommitsGroupedListProps) {
    return (
        <div className="space-y-6">
            {groupedCommits.map(([dateLabel, commits]) => (
                <div key={dateLabel}>
                    <h3 className="mb-2 px-2 py-1 font-medium text-sm text-text-secondary">
                        {dateLabel}
                    </h3>
                    <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
                        {commits.map((commit) => (
                            <CommitRow
                                key={commit.sha}
                                commit={commit}
                                owner={owner}
                                repo={repo}
                                provider={provider}
                                showStatus={showStatus}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
