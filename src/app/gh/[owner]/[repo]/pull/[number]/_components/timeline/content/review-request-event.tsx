"use client";

import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { UserLink } from "~/components/user-link";
import type {
    GQLReviewRequestedEvent,
    GQLReviewRequestRemovedEvent,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function ReviewRequestEventContent({
    event,
}: {
    event: GQLReviewRequestedEvent | GQLReviewRequestRemovedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const reviewer = event.requestedReviewer;
    const isUser = reviewer?.__typename === "User";
    const isTeam = reviewer?.__typename === "Team";
    const isRequested = event.__typename === "ReviewRequestedEvent";

    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {isRequested
                    ? " requested a review from "
                    : " removed the review request for "}
                {isUser && reviewer && (
                    <UserHoverCard login={reviewer.login}>
                        <a
                            className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-zinc-200"
                            href={reviewer.url}
                        >
                            <img
                                src={reviewer.avatarUrl}
                                alt={reviewer.login}
                                className="h-4 w-4 rounded-full"
                            />
                            {reviewer.login}
                        </a>
                    </UserHoverCard>
                )}
                {isTeam && reviewer && (
                    <span className="font-medium text-gray-800 dark:text-zinc-200">
                        {reviewer.name ?? reviewer.slug}
                    </span>
                )}
                {` ${timestamp}`}
            </p>
        </EventRow>
    );
}
