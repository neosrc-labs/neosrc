"use client";

import NextLink from "next/link";
import { UserLink } from "~/components/user-link";
import type { GQLHeadRefForcePushedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function HeadRefForcePushContent({
    event,
    owner,
    repo,
    number,
}: {
    event: GQLHeadRefForcePushedEvent;
    owner: string;
    repo: string;
    number: number;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const beforeShort = event.beforeCommit?.oid.slice(0, 7) ?? "unknown";
    const afterShort = event.afterCommit?.oid.slice(0, 7) ?? "unknown";
    const beforeHref = event.beforeCommit?.oid
        ? `/gh/${owner}/${repo}/pull/${number}/files/${event.beforeCommit.oid}`
        : null;
    const afterHref = event.afterCommit?.oid
        ? `/gh/${owner}/${repo}/pull/${number}/files/${event.afterCommit.oid}`
        : null;
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {"force pushed from "}
                {beforeHref ? (
                    <NextLink
                        href={beforeHref}
                        className="rounded bg-gray-100 px-1 text-xs hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                        {beforeShort}
                    </NextLink>
                ) : (
                    <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                        {beforeShort}
                    </code>
                )}
                {" to "}
                {afterHref ? (
                    <NextLink
                        href={afterHref}
                        className="rounded bg-gray-100 px-1 text-xs hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                        {afterShort}
                    </NextLink>
                ) : (
                    <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                        {afterShort}
                    </code>
                )}
            </p>
            {timestamp}
        </EventRow>
    );
}
