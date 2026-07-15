"use client";

import type { GQLReviewDismissedEvent } from "~/server/github-graphql";

export function ReviewDismissedContent({
    event,
}: {
    event: GQLReviewDismissedEvent;
}) {
    if (event.dismissalMessage) {
        return (
            <p className="text-sm text-text-secondary">
                {event.dismissalMessage}
            </p>
        );
    }
    return null;
}
