"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLHeadRefDeletedEvent,
    GQLHeadRefRestoredEvent,
} from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function HeadRefEventContent({
    event,
    provider,
}: {
    event: GQLHeadRefDeletedEvent | GQLHeadRefRestoredEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const verb =
        event.__typename === "HeadRefDeletedEvent" ? "deleted" : "restored";
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <p>
                {` ${verb} the `}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    branch
                </span>
                <span title={fullDate}>{` ${timestamp}`}</span>
            </p>
        </EventRow>
    );
}
