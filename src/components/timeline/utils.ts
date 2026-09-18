import type {
    GQLArchiveEvent,
    GQLPullRequestReview,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import type { LabelChange, TimelineWrapper } from "./types";

const MAX_LABEL_GAP_MS = 3 * 60 * 60 * 1000;

function deduplicateChanges(changes: LabelChange[]): LabelChange[] {
    const seen = new Set<string>();
    const result: LabelChange[] = [];

    for (const c of changes) {
        const key = `${c.label.name}:${c.event}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(c);
        }
    }

    return result;
}

function aggregateEvents(events: GQLTimelineEvent[]): TimelineWrapper[] {
    const result: TimelineWrapper[] = [];
    let i = 0;

    while (i < events.length) {
        const event = events[i] as GQLTimelineEvent;

        if (
            event.__typename === "LabeledEvent" ||
            event.__typename === "UnlabeledEvent"
        ) {
            const changes: LabelChange[] = [];
            const groupActorLogin = event.actor?.login ?? null;

            while (i < events.length) {
                const current = events[i] as GQLTimelineEvent;
                if (
                    current.__typename !== "LabeledEvent" &&
                    current.__typename !== "UnlabeledEvent"
                ) {
                    break;
                }
                // A different actor starts its own group so each row shows the
                // person who made those changes.
                if ((current.actor?.login ?? null) !== groupActorLogin) {
                    break;
                }
                if (changes.length > 0) {
                    const gap =
                        new Date(current.createdAt).getTime() -
                        new Date(
                            (changes[changes.length - 1] as LabelChange)
                                .createdAt,
                        ).getTime();
                    if (gap > MAX_LABEL_GAP_MS) break;
                }

                if (current.label && current.actor) {
                    changes.push({
                        label: {
                            name: current.label.name,
                            color: current.label.color,
                            description: current.label.description,
                        },
                        event:
                            current.__typename === "LabeledEvent"
                                ? "labeled"
                                : "unlabeled",
                        actor: current.actor,
                        createdAt: current.createdAt,
                    });
                }
                i++;
            }

            if (changes.length > 0) {
                const deduped = deduplicateChanges(changes);
                if (deduped.length === 0) continue;
                const lastChange = changes[changes.length - 1] as LabelChange;
                result.push({
                    type: "aggregated-label",
                    changes: deduped,
                    actor: lastChange.actor,
                    createdAt: lastChange.createdAt,
                });
            }
        } else {
            result.push({ type: "raw", event: event });
            i++;
        }
    }

    return result;
}

function filterTimelineEvents(events: GQLTimelineEvent[]): GQLTimelineEvent[] {
    let hasSeenMerge = false;
    return events.filter((event) => {
        if (
            event.__typename === "MentionedEvent" ||
            event.__typename === "SubscribedEvent"
        ) {
            return false;
        }
        if (event.__typename === "MergedEvent") {
            hasSeenMerge = true;
            return true;
        }
        // GitHub emits both a MergedEvent and a ClosedEvent when a PR is merged.
        // The CloseEvent is redundant, so skip it when it follows a merge.
        if (event.__typename === "ClosedEvent" && hasSeenMerge) {
            return false;
        }
        // Merging automatically removes the PR from the merge queue, so
        // RemovedFromMergeQueueEvent is redundant when it follows a merge.
        if (event.__typename === "RemovedFromMergeQueueEvent" && hasSeenMerge) {
            return false;
        }
        return true;
    });
}

/**
 * GitHub shows a green approval check when the reviewer has write access to
 * the repository and a gray check otherwise. An undefined permission (e.g.
 * anonymous viewer, unresolved lookup) keeps the green check.
 */
export function approvalHasWriteAccess(
    permission: GQLPullRequestReview["authorPermission"],
): boolean {
    return permission !== "read" && permission !== "none";
}

/**
 * Archive events come from the REST issue events feed rather than the GraphQL
 * timeline, so they are spliced in by timestamp. Later events with an equal
 * timestamp keep their place ahead of an archive entry, and commit entries
 * carry no timestamp of their own so they never sort past one.
 */
function mergeArchiveEvents(
    events: GQLTimelineEvent[],
    archiveEvents: GQLArchiveEvent[],
): GQLTimelineEvent[] {
    if (archiveEvents.length === 0) return events;

    const merged = [...events];
    for (const archiveEvent of archiveEvents) {
        const createdAt = Date.parse(archiveEvent.createdAt);
        const index = merged.findIndex((event) => {
            const eventTime =
                "createdAt" in event ? Date.parse(event.createdAt) : Number.NaN;
            return eventTime > createdAt;
        });
        merged.splice(index === -1 ? merged.length : index, 0, archiveEvent);
    }
    return merged;
}

export { aggregateEvents, filterTimelineEvents, mergeArchiveEvents };
