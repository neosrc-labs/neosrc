"use client";

import { UserLink } from "~/components/user-link";
import type { GQLBaseRefChangedEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function BaseRefChangedContent({
    event,
    provider,
}: {
    event: GQLBaseRefChangedEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <p>
                {" changed the base branch from "}
                <span className="font-medium text-gray-800 line-through dark:text-zinc-200">
                    {event.previousRefName}
                </span>
                {" → "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {event.currentRefName}
                </span>{" "}
                <span title={fullDate}>{timestamp}</span>
            </p>
        </EventRow>
    );
}
