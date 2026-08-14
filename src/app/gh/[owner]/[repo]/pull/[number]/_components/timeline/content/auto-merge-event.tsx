"use client";

import type {
    GQLAutoMergeDisabledEvent,
    GQLAutoMergeEnabledEvent,
} from "~/server/github-graphql";
import { MergeEventRow } from "./merge-event-row";

export function AutoMergeEventContent({
    event,
}: {
    event: GQLAutoMergeEnabledEvent | GQLAutoMergeDisabledEvent;
}) {
    return (
        <MergeEventRow
            event={event}
            isActive={event.__typename === "AutoMergeEnabledEvent"}
            activeText=" enabled auto-merge"
            inactiveText=" disabled auto-merge"
        />
    );
}
