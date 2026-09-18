/**
 * GitHub archived pull requests -> shared timeline events.
 *
 * Archiving closes and locks a pull request, but the archived flag and the
 * archived/unarchived events are missing from both the pull request payload and
 * the GraphQL timeline. The REST issue events feed is the only source, so this
 * module is the only place those entries are translated into the shape the
 * shared timeline renderers consume.
 */
import { cache } from "react";
import type { GQLActor, GQLArchiveEvent } from "~/server/github-graphql";
import { createOctokit } from "./client";

export type PullRequestArchive = {
    /** True while the pull request is archived. */
    archived: boolean;
    /** Archived/unarchived events, oldest first. */
    archiveEvents: GQLArchiveEvent[];
};

type Actor = {
    login: string;
    avatar_url: string;
    html_url: string;
    type?: string | null;
};

/** Fields of a REST issue event that this module reads. */
export type RestIssueEvent = {
    id: number;
    node_id: string;
    event: string;
    created_at: string;
    actor: Actor | null;
};

const ARCHIVE_TYPENAMES: Record<string, "ArchivedEvent" | "UnarchivedEvent"> = {
    archived: "ArchivedEvent",
    unarchived: "UnarchivedEvent",
};
const EVENTS_PER_PAGE = 100;

function mapActor(actor: Actor | null): GQLActor | null {
    if (!actor) return null;
    return {
        __typename: actor.type === "Bot" ? "Bot" : "User",
        login: actor.login,
        avatarUrl: actor.avatar_url,
        url: actor.html_url,
    };
}

/**
 * Keeps the archive entries and derives the current state from the newest one.
 * Unarchiving emits its own event, so the last event wins.
 */
export function mapPullRequestArchive(
    events: RestIssueEvent[],
): PullRequestArchive {
    const archiveEvents: GQLArchiveEvent[] = [];
    for (const event of events) {
        const typename = ARCHIVE_TYPENAMES[event.event];
        if (!typename) continue;
        archiveEvents.push({
            __typename: typename,
            id: event.node_id,
            actor: mapActor(event.actor),
            createdAt: event.created_at,
        });
    }

    const newest = archiveEvents[archiveEvents.length - 1];
    return {
        archived: newest?.__typename === "ArchivedEvent",
        archiveEvents,
    };
}

export const getPullRequestArchive = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<PullRequestArchive> =>
        mapPullRequestArchive(
            await listIssueEvents(accessToken, owner, repo, pullNumber),
        ),
);

/**
 * Archive entries sit at the end of a timeline while page one holds the oldest
 * events, so both ends are read. Ids increase over time, which restores
 * chronological order once the pages are merged.
 */
async function listIssueEvents(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<RestIssueEvent[]> {
    const octokit = createOctokit(accessToken);
    const firstPage = await octokit.rest.issues.listEvents({
        owner,
        repo,
        issue_number: pullNumber,
        per_page: EVENTS_PER_PAGE,
    });

    const lastPage = lastPageNumber(firstPage.headers.link);
    if (lastPage === 1) return firstPage.data;

    const finalPage = await octokit.rest.issues.listEvents({
        owner,
        repo,
        issue_number: pullNumber,
        per_page: EVENTS_PER_PAGE,
        page: lastPage,
    });

    const seen = new Set<number>();
    const merged: RestIssueEvent[] = [];
    for (const event of [...firstPage.data, ...finalPage.data]) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        merged.push(event);
    }
    return merged.sort((a, b) => a.id - b.id);
}

function lastPageNumber(link: string | undefined): number {
    const last = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    const page = last?.[1] ? Number(last[1]) : 1;
    return Number.isFinite(page) && page > 0 ? page : 1;
}
