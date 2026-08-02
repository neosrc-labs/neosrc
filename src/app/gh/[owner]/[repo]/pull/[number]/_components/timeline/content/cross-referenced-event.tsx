"use client";

import NextLink from "next/link";
import type { PullRequestState } from "~/components/ui/status-pill";
import { StatusPill } from "~/components/ui/status-pill";
import { UserLink } from "~/components/user-link";
import type { GQLCrossReferencedEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";

export function CrossReferencedEventContent({
    event,
    owner,
    repo,
}: {
    event: GQLCrossReferencedEvent;
    owner: string;
    repo: string;
}) {
    const actor = event.actor;
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const source = event.source;
    const repoName = source?.repository.name;
    const repoOwner = source?.repository.owner.login;
    const sourceNumber = source?.number;
    const sourceTitle = source?.title;
    const sourceUrl = source?.url;
    const isPR = source?.__typename === "PullRequest";
    const isSameRepo = repoOwner === owner && repoName === repo;
    const appHref =
        repoOwner && repoName && sourceNumber
            ? `/gh/${repoOwner}/${repoName}/${isPR ? "pull" : "issues"}/${sourceNumber}`
            : null;
    const sourceRef =
        sourceNumber &&
        (isSameRepo
            ? `#${sourceNumber}`
            : `${repoOwner}/${repoName}#${sourceNumber}`);
    const pillState = source?.state.toLowerCase() as
        | PullRequestState
        | undefined;

    const inner = (
        <>
            <span className="flex min-w-0 items-center gap-1.5 hover:underline">
                <span className="truncate font-medium text-gray-800 dark:text-zinc-200">
                    {sourceTitle}
                </span>
                {sourceRef && (
                    <span className="shrink-0 text-text-muted text-xs">
                        {sourceRef}
                    </span>
                )}
            </span>
            {pillState && <StatusPill state={pillState} />}
        </>
    );

    return (
        <div className="text-sm text-text-secondary">
            <div className="flex items-center gap-2">
                <UserLink actor={actor} />
                <span title={fullDate}>
                    {` mentioned this ${isPR ? "pull request" : "issue"} `}
                    {timestamp}
                </span>
            </div>
            {source &&
                (appHref ? (
                    <NextLink
                        href={appHref}
                        className="mt-1 ml-7 flex items-center justify-between gap-1.5"
                    >
                        {inner}
                    </NextLink>
                ) : (
                    <a
                        href={sourceUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 ml-7 flex items-center justify-between gap-1.5"
                    >
                        {inner}
                    </a>
                ))}
        </div>
    );
}
