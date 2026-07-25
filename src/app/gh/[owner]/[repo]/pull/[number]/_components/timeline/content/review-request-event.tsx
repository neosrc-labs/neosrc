"use client";

import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { UserLink } from "~/components/user-link";
import type {
    GQLReviewRequestedEvent,
    GQLReviewRequestRemovedEvent,
} from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";

export function ReviewRequestEventContent({
    event,
}: {
    event: GQLReviewRequestedEvent | GQLReviewRequestRemovedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const reviewer = event.requestedReviewer;
    const isUser = reviewer?.__typename === "User";
    const isTeam = reviewer?.__typename === "Team";
    const isRequested = event.__typename === "ReviewRequestedEvent";
    const isSelfRequest = isUser && event.actor?.login === reviewer?.login;

    return (
        <div className="flex items-center gap-1 text-sm text-text-secondary">
            <UserLink actor={event.actor} />
            {isSelfRequest && isRequested ? (
                <span title={fullDate}>
                    self-requested a review {timestamp}
                </span>
            ) : isSelfRequest ? (
                <span title={fullDate}>
                    removed their request for review {timestamp}
                </span>
            ) : (
                <>
                    <span>
                        {isRequested
                            ? "requested a review from"
                            : "removed the review request for"}
                    </span>
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
                    <span className="whitespace-nowrap" title={fullDate}>
                        {timestamp}
                    </span>
                </>
            )}
        </div>
    );
}
