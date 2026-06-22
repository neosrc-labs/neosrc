"use client";

import { UserLink } from "~/components/user-link";
import type {
    GQLAddedToProjectV2Event,
    GQLProjectV2ItemStatusChangedEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function ProjectEventContent({
    event,
}: {
    event: GQLAddedToProjectV2Event | GQLProjectV2ItemStatusChangedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const isAdded = event.__typename === "AddedToProjectV2Event";
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {isAdded
                    ? "Added this issue to a project "
                    : "changed the project status "}
                {timestamp}
            </p>
        </EventRow>
    );
}
