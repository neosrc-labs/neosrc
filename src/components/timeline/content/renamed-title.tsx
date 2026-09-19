"use client";

import { UserLink } from "~/components/user/user-link";
import type { GQLRenamedTitleEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function RenamedTitleContent({
    event,
    provider,
}: {
    event: GQLRenamedTitleEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <p>
                {" renamed this "}
                <span className="font-medium text-text-label line-through">
                    {event.previousTitle}
                </span>
                {" → "}
                <span className="font-medium text-text-label">
                    {event.currentTitle}
                </span>{" "}
                <span title={fullDate}>{timestamp}</span>
            </p>
        </EventRow>
    );
}
