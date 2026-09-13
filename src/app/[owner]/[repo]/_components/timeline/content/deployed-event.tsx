"use client";

import { UserLink } from "~/components/user-link";
import type { GQLDeployedEvent } from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils";
import type { Provider } from "~/utils/provider-url";
import { EventRow } from "../event";

export function DeployedEventContent({
    event,
    provider,
}: {
    event: GQLDeployedEvent;
    provider: Provider;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const environment = event.deployment?.environment ?? "a deployment";
    const refName = event.ref?.name ?? null;
    return (
        <EventRow>
            <UserLink actor={event.actor} provider={provider} />
            <p>
                {" deployed to "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                    {environment}
                </span>
                {refName ? (
                    <>
                        {" ("}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {refName}
                        </span>
                        {")"}
                    </>
                ) : null}
                <span title={fullDate}>{` ${timestamp}`}</span>
            </p>
        </EventRow>
    );
}
