"use client";

import { UserLink } from "~/components/user-link";
import type { GQLLockedEvent, GQLUnlockedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow, formatReason } from "../event";

export function LockedEventContent({
    event,
}: {
    event: GQLLockedEvent | GQLUnlockedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    if (event.__typename === "UnlockedEvent") {
        return (
            <EventRow>
                <UserLink actor={event.actor} />
                <p>
                    {" unlocked this "}
                    {timestamp}
                </p>
            </EventRow>
        );
    }
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" locked this"}
                {event.lockReason && (
                    <>
                        {" (reason: "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {formatReason(event.lockReason)}
                        </span>
                        {")"}
                    </>
                )}
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
