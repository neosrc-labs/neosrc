"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLDemilestonedEvent,
    GQLMilestonedEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function MilestoneEventContent({
    event,
}: {
    event: GQLMilestonedEvent | GQLDemilestonedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const isAdded = event.__typename === "MilestonedEvent";
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {isAdded ? " added the milestone " : " removed the milestone "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {event.milestoneTitle ?? ""}
                </span>
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
