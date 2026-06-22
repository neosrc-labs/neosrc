"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLAutoMergeDisabledEvent,
    GQLAutoMergeEnabledEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function AutoMergeEventContent({
    event,
}: {
    event: GQLAutoMergeEnabledEvent | GQLAutoMergeDisabledEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const isEnabled = event.__typename === "AutoMergeEnabledEvent";
    if (isEnabled) {
        return (
            <EventRow>
                <UserLink actor={event.actor} />
                <p>
                    {" enabled auto-merge"}
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
                {" disabled auto-merge"}
                {reasonDisplay ? ` — ${reasonDisplay}` : ""}
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
