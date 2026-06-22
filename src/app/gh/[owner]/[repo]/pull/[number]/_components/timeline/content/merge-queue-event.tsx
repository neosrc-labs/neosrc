"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLAddedToMergeQueueEvent,
    GQLRemovedFromMergeQueueEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function MergeQueueEventContent({
    event,
}: {
    event: GQLAddedToMergeQueueEvent | GQLRemovedFromMergeQueueEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const isAdded = event.__typename === "AddedToMergeQueueEvent";
    if (isAdded) {
        return (
            <EventRow>
                <UserLink actor={event.actor} />
                <p>
                    {" queued this PR in the merge queue"}
                    {` ${timestamp}`}
                </p>
            </EventRow>
        );
    }
    const reasonDisplay = event.reason
        ? event.reason.toLowerCase().replace(/_/g, " ")
        : null;
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" removed this PR from the merge queue"}
                {reasonDisplay ? ` — ${reasonDisplay}` : ""}
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
