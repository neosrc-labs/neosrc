"use client";

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
                <AuthorDropdown
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    currentQuery={author ? `author:${author}` : ""}
                    onToggle={onAuthorToggle}
                    selectedAuthor={author}
                />
            </div>
        </div>
    );
}
