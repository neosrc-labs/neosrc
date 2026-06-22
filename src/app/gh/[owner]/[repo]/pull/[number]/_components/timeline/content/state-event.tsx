"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLClosedEvent,
    GQLConvertToDraftEvent,
    GQLReadyForReviewEvent,
    GQLReopenedEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function StateEventContent({
    event,
}: {
    event:
        | GQLClosedEvent
        | GQLReopenedEvent
        | GQLConvertToDraftEvent
        | GQLReadyForReviewEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const verb =
        event.__typename === "ClosedEvent"
            ? "closed"
            : event.__typename === "ReopenedEvent"
              ? "reopened"
              : event.__typename === "ConvertToDraftEvent"
                ? "converted to draft"
                : "marked ready for review";
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {verb}
                {" this "}
                {timestamp}
            </p>
        </EventRow>
    );
}
