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
                        className="rounded bg-surface-tertiary px-1 text-xs hover:bg-surface-selected"
                    >
                        {beforeShort}
                    </NextLink>
                ) : (
                    <code className="rounded bg-surface-tertiary px-1 text-xs">
                        {beforeShort}
                    </code>
                )}
                {" to "}
                {afterHref ? (
                    <NextLink
                        href={afterHref}
                        className="rounded bg-surface-tertiary px-1 text-xs hover:bg-surface-selected"
                    >
                        {afterShort}
                    </NextLink>
                ) : (
                    <code className="rounded bg-surface-tertiary px-1 text-xs">
                        {afterShort}
                    </code>
                )}
            </p>
            {timestamp}
        </EventRow>
    );
}
