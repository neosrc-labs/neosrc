"use client";

import { RefSelector } from "~/components/repo/ref-selector";
import { AuthorDropdown } from "~/components/search/author-dropdown";
import type { RepositoryReference } from "~/utils/provider-url";

interface CommitsToolbarProps {
    owner: string;
    repo: string;
    reference: RepositoryReference;
    provider: "gh" | "cb";
    author: string | undefined;
    onReferenceChange: (reference: RepositoryReference) => void;
    onAuthorToggle: (key: string, value: string) => void;
}

export function CommitsToolbar({
    owner,
    repo,
    reference,
    provider,
    author,
    onReferenceChange,
    onAuthorToggle,
}: CommitsToolbarProps) {
    return (
        <div className="mb-6 flex items-center justify-between gap-4">
            <RefSelector
                owner={owner}
                repo={repo}
                provider={provider}
                reference={reference}
                onSelect={onReferenceChange}
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
