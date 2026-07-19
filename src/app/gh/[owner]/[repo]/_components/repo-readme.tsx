"use client";

import { BookOpenTextIcon } from "lucide-react";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";

import { api } from "~/trpc/react";

interface RepoReadmeProps {
    owner: string;
    repo: string;
    ref: string;
}

export function RepoReadme({ owner, repo, ref }: RepoReadmeProps) {
    const { data: readme, isLoading } = api.repos.getReadme.useQuery({
        owner,
        repo,
        ref,
    });

    if (isLoading) {
        return (
            <div className="mt-6 rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 h-4 w-24 animate-pulse rounded bg-surface-secondary" />
                <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-surface-secondary" />
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6 rounded-xl border border-border bg-surface">
            {readme ? (
                <>
                    <div className="flex items-center gap-2 border-border border-b px-6 py-3">
                        <BookOpenTextIcon className="h-4 w-4 text-text-tertiary" />
                        <h2 className="font-semibold text-sm text-text-secondary">
                            README.md
                        </h2>
                    </div>
                    <div className="p-6">
                        <MarkdownRenderer
                            content={readme.content}
                            owner={owner}
                            repo={repo}
                            canToggleTasks={false}
                        />
                    </div>
                </>
            ) : (
                <div className="px-6 py-8 text-center text-sm text-text-tertiary">
                    No README found.
                </div>
            )}
        </div>
    );
}
