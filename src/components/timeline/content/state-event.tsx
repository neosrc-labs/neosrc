"use client";

import { UserLink } from "~/components/user/user-link";
import type {
    GQLClosedEvent,
    GQLConvertToDraftEvent,
    GQLReadyForReviewEvent,
    GQLReopenedEvent,
} from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function StateEventContent({
    event,
    provider,
}: {
    event:
        | GQLClosedEvent
        | GQLReopenedEvent
        | GQLConvertToDraftEvent
        | GQLReadyForReviewEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    let action: string;
    if (event.__typename === "ClosedEvent") {
        const reason = event.stateReason
            ? ` as ${event.stateReason.toLowerCase().replace(/_/g, " ")}`
            : "";
        action = `closed this${reason}`;
    } else if (event.__typename === "ReopenedEvent") {
        action = "reopened this";
    } else if (event.__typename === "ConvertToDraftEvent") {
        action = "converted to draft this";
    } else {
        action = "marked ready for review this";
    }
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <p>
                {action} <span title={fullDate}>{timestamp}</span>
            </p>
        </EventRow>
    );
}
