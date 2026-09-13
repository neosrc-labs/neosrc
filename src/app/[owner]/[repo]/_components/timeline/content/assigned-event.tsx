"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLAssignedEvent,
    GQLUnassignedEvent,
} from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function AssignedEventContent({
    event,
    provider,
}: {
    event: GQLAssignedEvent | GQLUnassignedEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const isSelfAssigned = event.actor?.login === event.assignee?.login;
    const isAssigned = event.__typename === "AssignedEvent";

    if (isSelfAssigned && event.assignee) {
        return (
            <EventRow>
                <UserLink actor={event.assignee} provider={provider} />
                <span title={fullDate}>
                    {isAssigned
                        ? " self-assigned this "
                        : " removed their assignment "}
                    {timestamp}
                </span>
            </EventRow>
        );
    }
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <div className="flex gap-1">
                {isAssigned ? " assigned " : " unassigned "}
                <UserLink actor={event.assignee} provider={provider} />{" "}
                <span title={fullDate}>{timestamp}</span>
            </div>
        </EventRow>
    );
}
