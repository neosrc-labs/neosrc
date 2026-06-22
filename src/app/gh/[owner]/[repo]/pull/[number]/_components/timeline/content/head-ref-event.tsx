"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLHeadRefDeletedEvent,
    GQLHeadRefRestoredEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function HeadRefEventContent({
    event,
}: {
    event: GQLHeadRefDeletedEvent | GQLHeadRefRestoredEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const verb =
        event.__typename === "HeadRefDeletedEvent" ? "deleted" : "restored";
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {` ${verb} the `}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    branch
                </span>
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
