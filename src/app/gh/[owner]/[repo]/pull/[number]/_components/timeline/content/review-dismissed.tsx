"use client";

import type { GQLReviewDismissedEvent } from "~/server/github-graphql";

export function ReviewDismissedContent({
    event,
}: {
    event: GQLReviewDismissedEvent;
}) {
    if (event.dismissalMessage) {
        return (
            <p className="text-gray-600 text-sm dark:text-zinc-400">
                {event.dismissalMessage}
            </p>
        );
    }
    return null;
}
