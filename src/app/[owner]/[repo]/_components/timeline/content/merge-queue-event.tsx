"use client";

import type {
    GQLAddedToMergeQueueEvent,
    GQLRemovedFromMergeQueueEvent,
} from "~/server/github-graphql";
import type { Provider } from "~/utils/provider-url";
import { MergeEventRow } from "./merge-event-row";

export function MergeQueueEventContent({
    event,
    provider,
}: {
    event: GQLAddedToMergeQueueEvent | GQLRemovedFromMergeQueueEvent;
    provider: Provider;
}) {
    return (
        <MergeEventRow
            event={event}
            provider={provider}
            isActive={event.__typename === "AddedToMergeQueueEvent"}
            activeText=" queued this PR in the merge queue"
            inactiveText=" removed this PR from the merge queue"
        />
    );
}
