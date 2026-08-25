"use client";

import type {
    GQLAutoMergeDisabledEvent,
    GQLAutoMergeEnabledEvent,
    GQLAutoRebaseEnabledEvent,
    GQLAutoSquashEnabledEvent,
} from "~/server/github-graphql";
import { MergeEventRow } from "./merge-event-row";

export function AutoMergeEventContent({
    event,
}: {
    event:
        | GQLAutoMergeEnabledEvent
        | GQLAutoSquashEnabledEvent
        | GQLAutoRebaseEnabledEvent
        | GQLAutoMergeDisabledEvent;
}) {
    const isEnabled =
        event.__typename === "AutoMergeEnabledEvent" ||
        event.__typename === "AutoSquashEnabledEvent" ||
        event.__typename === "AutoRebaseEnabledEvent";
    const mergeMethod =
        event.__typename === "AutoSquashEnabledEvent"
            ? "squash"
            : event.__typename === "AutoRebaseEnabledEvent"
              ? "rebase"
              : event.__typename === "AutoMergeEnabledEvent"
                ? "merge"
                : null;
    return (
        <MergeEventRow
            event={event}
            isActive={isEnabled}
            activeText={
                mergeMethod
                    ? ` enabled auto-merge (${mergeMethod})`
                    : " enabled auto-merge"
            }
            inactiveText=" disabled auto-merge"
        />
    );
}
