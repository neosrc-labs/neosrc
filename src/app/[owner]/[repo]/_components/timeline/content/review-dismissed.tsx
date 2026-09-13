"use client";

import { UserLink } from "~/components/user-link";
import type { GQLReviewDismissedEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function ReviewDismissedContent({
    event,
}: {
    event: GQLReviewDismissedEvent;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    return (
        <>
            <EventRow>
                <UserLink actor={event.actor} />
                <p>
                    dismissed their review{" "}
                    <span title={fullDate}>{timestamp}</span>
                </p>
            </EventRow>
            {event.dismissalMessage && (
                <div className="relative mt-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary">
                    <svg
                        width="16"
                        height="8"
                        viewBox="0 0 16 8"
                        className="absolute -top-2 left-7"
                        aria-hidden="true"
                    >
                        <path
                            d="M 0,8 L 8,0 L 16,8"
                            className="stroke-border"
                            fill="none"
                            strokeWidth="1"
                        />
                        <polygon
                            points="0,8 8,0 16,8"
                            className="fill-surface-elevated"
                        />
                    </svg>
                    {event.dismissalMessage}
                </div>
            )}
        </>
    );
}
