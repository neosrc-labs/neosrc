"use client";

import type {
    GQLAddedToMergeQueueEvent,
    GQLRemovedFromMergeQueueEvent,
} from "~/server/github-graphql";
import { MergeEventRow } from "./merge-event-row";

export function MergeQueueEventContent({
    event,
}: {
    event: GQLAddedToMergeQueueEvent | GQLRemovedFromMergeQueueEvent;
}) {
    return (
        <MergeEventRow
            event={event}
            isActive={event.__typename === "AddedToMergeQueueEvent"}
            activeText=" queued this PR in the merge queue"
            inactiveText=" removed this PR from the merge queue"
        />
    );
}
