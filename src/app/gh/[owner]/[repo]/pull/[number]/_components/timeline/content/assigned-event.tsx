"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLAssignedEvent,
    GQLUnassignedEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function AssignedEventContent({
    event,
}: {
    event: GQLAssignedEvent | GQLUnassignedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const isSelfAssigned = event.actor?.login === event.assignee?.login;
    const isAssigned = event.__typename === "AssignedEvent";

    if (isSelfAssigned && event.assignee) {
        return (
            <EventRow>
                <UserLink actor={event.assignee} />
                <span>
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
            <UserLink actor={event.actor} />
            <div className="flex gap-1">
                {isAssigned ? " assigned " : " unassigned "}
                <UserLink actor={event.assignee} /> {timestamp}
            </div>
        </EventRow>
    );
}
