"use client";

import { UserLink } from "~/components/user-link";
import type { GQLMergedEvent } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { EventRow } from "../event";

export function MergedEventContent({
    event,
    owner,
    repo,
}: {
    event: GQLMergedEvent;
    owner: string;
    repo: string;
}) {
    const timestamp = formatRelativeTime(event.createdAt);
    const sha = event.commit?.abbreviatedOid;
    const commitUrl = event.commit?.commitUrl;
    return (
        <EventRow>
            <UserLink actor={event.actor} />
            <p>
                {" merged commit "}
                {sha && commitUrl ? (
                    <a
                        href={commitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                    >
                        {sha}
                    </a>
                ) : (
                    <span className="font-mono text-xs">{sha}</span>
                )}
                {" into "}
                <a
                    href={`https://github.com/${owner}/${repo}/tree/${event.mergeRefName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                >
                    {event.mergeRefName}
                </a>
                {" this "}
                {timestamp}
            </p>
        </EventRow>
    );
}
