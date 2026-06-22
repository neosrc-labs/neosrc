"use client";

import { UserLink } from "~/components/user-link";
import type { GQLCrossReferencedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";

export function CrossReferencedEventContent({
    event,
}: {
    event: GQLCrossReferencedEvent;
}) {
    const actor = event.actor;
    const timestamp = formatRelativeTime(event.createdAt);
    const source = event.source;
    const repoName = source?.repository.name;
    const repoOwner = source?.repository.owner.login;
    const repoFullName =
        repoOwner && repoName ? `${repoOwner}/${repoName}` : null;
    const sourceNumber = source?.number;
    const sourceTitle = source?.title;
    const sourceUrl = source?.url;
    const isPR = source?.__typename === "PullRequest";

    return (
        <div className="text-gray-600 text-sm dark:text-zinc-400">
            <div className="flex items-center gap-2">
                <UserLink actor={actor} />
                <span>
                    {` mentioned this ${isPR ? "pull request" : "issue"} `}
                    {timestamp}
                </span>
            </div>
            {source && (
                <a
                    href={sourceUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 ml-7 flex w-fit items-center gap-1.5 hover:underline"
                >
                    <span className="font-medium text-gray-800 dark:text-zinc-200">
                        {sourceTitle}
                    </span>
                    {repoFullName && sourceNumber && (
                        <span className="text-gray-400 text-xs dark:text-zinc-500">
                            {repoFullName}#{sourceNumber}
                        </span>
                    )}
                </a>
            )}
        </div>
    );
}
