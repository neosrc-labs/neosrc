"use client";

import type {
    GQLAutoMergeDisabledEvent,
    GQLAutoMergeEnabledEvent,
    GQLAutoRebaseEnabledEvent,
    GQLAutoSquashEnabledEvent,
} from "~/server/github-graphql";
import type { Provider } from "~/utils/provider-url";
import { MergeEventRow } from "./merge-event-row";

export function AutoMergeEventContent({
    event,
    provider,
}: {
    event:
        | GQLAutoMergeEnabledEvent
        | GQLAutoSquashEnabledEvent
        | GQLAutoRebaseEnabledEvent
        | GQLAutoMergeDisabledEvent;
    provider: Provider;
}) {
    const isEnabled =
        event.__typename === "AutoMergeEnabledEvent" ||
        event.__typename === "AutoSquashEnabledEvent" ||
        event.__typename === "AutoRebaseEnabledEvent";
    let mergeMethod: "squash" | "rebase" | "merge" | null = null;
    if (event.__typename === "AutoSquashEnabledEvent") {
        mergeMethod = "squash";
    } else if (event.__typename === "AutoRebaseEnabledEvent") {
        mergeMethod = "rebase";
    } else if (event.__typename === "AutoMergeEnabledEvent") {
        mergeMethod = "merge";
    }
    return (
        <MergeEventRow
            event={event}
            provider={provider}
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
