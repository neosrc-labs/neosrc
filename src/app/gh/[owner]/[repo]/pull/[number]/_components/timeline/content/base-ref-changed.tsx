"use client";

import { UserLink } from "~/components/user-link";
import type { GQLBaseRefChangedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function BaseRefChangedContent({
    event,
}: {
    event: GQLBaseRefChangedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" changed the base branch from "}
                <span className="font-medium text-gray-800 line-through dark:text-zinc-200">
                    {event.previousRefName}
                </span>
                {" → "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {event.currentRefName}
                </span>{" "}
                {timestamp}
            </p>
        </EventRow>
    );
}
