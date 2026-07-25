"use client";

import { UserLink } from "~/components/user-link";
import type { GQLReferencedEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";

export function ReferencedEventContent({
    event,
}: {
    event: GQLReferencedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const sha = event.commit?.oid?.slice(0, 7);
    return (
        <div className="flex items-center justify-between text-sm text-text-secondary">
            <div className="flex items-center gap-1">
                <UserLink actor={event.actor} />
                <span>
                    {" referenced this "}
                    <span title={fullDate}>{timestamp}</span>
                </span>
            </div>
            {sha && (
                <a
                    href={event.commit?.commitUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs hover:underline"
                >
                    {sha}
                </a>
            )}
        </div>
    );
}
