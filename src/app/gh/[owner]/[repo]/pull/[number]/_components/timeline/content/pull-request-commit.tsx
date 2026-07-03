"use client";

import NextLink from "next/link";
import { CommitAuthors } from "~/components/commit-authors";
import { CommitSubject } from "~/components/commit-subject";
import { VerifiedBadge } from "~/components/verified-badge";
import type { GQLPullRequestCommit } from "~/server/github-graphql";

export function PullRequestCommitContent({
    event,
    owner,
    repo,
    number,
}: {
    event: GQLPullRequestCommit;
    owner: string;
    repo: string;
    number: number;
}) {
    const commit = event.commit;
    return (
        <div className="item-center flex justify-between text-gray-600 text-sm dark:text-zinc-400">
            <div className="item-center flex min-w-0 gap-2">
                {commit && (
                    <CommitAuthors
                        authors={commit.authors?.nodes ?? []}
                        size={20}
                    />
                )}
                <NextLink
                    href={`/gh/${owner}/${repo}/pull/${number}/files/${commit?.oid}`}
                    className="truncate hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                >
                    <CommitSubject
                        message={commit?.message ?? ""}
                        className="truncate"
                    />
                </NextLink>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {commit?.signature?.isValid && (
                    <VerifiedBadge signature={commit.signature} />
                )}
                <NextLink
                    href={`/gh/${owner}/${repo}/pull/${number}/files/${commit?.oid}`}
                    className="font-mono text-gray-600 text-xs hover:text-blue-600 hover:underline dark:text-zinc-400 dark:hover:text-blue-400"
                >
                    {commit?.oid.slice(0, 7)}
                </NextLink>
            </div>
        </div>
    );
}
