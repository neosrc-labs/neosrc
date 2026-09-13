"use client";

import type { ComponentProps } from "react";
import { UserLink } from "~/components/user-link";
import { formatDateTime, formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function MergeEventRow({
    event,
    activeText,
    inactiveText,
    isActive,
}: {
    event: {
        actor: ComponentProps<typeof UserLink>["actor"];
        createdAt: string;
        reason?: string | null;
    };
    activeText: string;
    inactiveText: string;
    isActive: boolean;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const fullDate = formatDateTime(event.createdAt);
    const reasonDisplay = event.reason
        ? event.reason.toLowerCase().replace(/_/g, " ")
        : null;

    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {isActive ? activeText : inactiveText}
                {!isActive && reasonDisplay ? ` — ${reasonDisplay}` : ""}
                <span title={fullDate}>{` ${timestamp}`}</span>
            </p>
        </EventRow>
    );
}
