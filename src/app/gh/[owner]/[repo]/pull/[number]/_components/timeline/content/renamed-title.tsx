"use client";

import { UserLink } from "~/components/user-link";
import type { GQLRenamedTitleEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function RenamedTitleContent({
    event,
}: {
    event: GQLRenamedTitleEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" renamed this "}
                <span className="font-medium text-gray-800 line-through dark:text-zinc-200">
                    {event.previousTitle}
                </span>
                {" → "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {event.currentTitle}
                </span>{" "}
                {timestamp}
            </p>
        </EventRow>
    );
}
