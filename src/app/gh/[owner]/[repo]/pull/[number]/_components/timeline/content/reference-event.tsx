"use client";

import { UserLink } from "~/components/user-link";
import type { GQLReferencedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function ReferencedEventContent({
    event,
}: {
    event: GQLReferencedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const sha = event.commit?.oid?.slice(0, 7);
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" referenced this "}
                {timestamp}
            </p>
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
        </EventRow>
    );
}
