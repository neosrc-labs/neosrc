"use client";

import { X } from "lucide-react";
import { RefSelector } from "~/app/[owner]/[repo]/_components/ref-selector";
import { AuthorDropdown } from "~/app/[owner]/[repo]/_components/search/author-dropdown";

interface CommitsToolbarProps {
    owner: string;
    repo: string;
    branch: string;
    provider: "gh" | "cb";
    author: string | undefined;
    onBranchChange: (branch: string) => void;
    onAuthorToggle: (key: string, value: string) => void;
}

export function CommitsToolbar({
    owner,
    repo,
    branch,
    provider,
    author,
    onBranchChange,
    onAuthorToggle,
}: CommitsToolbarProps) {
    return (
        <div className="mb-6 flex items-center justify-between gap-4">
            <RefSelector
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={branch}
                onSelect={onBranchChange}
            />

            <div className="flex items-center gap-2">
                {author && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-tertiary px-2 py-1 text-sm">
                        <span className="text-text-secondary">author:</span>
                        <span className="font-medium text-text-primary">
                            {author}
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                onAuthorToggle("author", `author:${author}`)
                            }
                            className="ml-0.5 rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
                            aria-label="Clear author filter"
                        >
                            <X className="size-3" />
                        </button>
                    </span>
                )}
                <AuthorDropdown
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    currentQuery={author ? `author:${author}` : ""}
                    onToggle={onAuthorToggle}
                />
            </div>
        </div>
    );
}
