"use client";

import { UserLink } from "~/components/user/user-link";
import type { GQLArchiveEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function ArchiveEventContent({
    event,
    provider,
}: {
    event: GQLArchiveEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const action =
        event.__typename === "ArchivedEvent" ? "archived" : "unarchived";

    return (
        <EventRow>
            <div className="flex flex-wrap items-center gap-1">
                {"A repository admin"}
                <UserLink actor={event.actor} provider={provider} />
                {`${action} this`}
                <span title={fullDate}>{timestamp}</span>
            </div>
        </EventRow>
    );
}
