import type { GQLTimelineEvent } from "~/server/github-graphql";
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

            while (i < events.length) {
                const current = events[i] as GQLTimelineEvent;
                if (
                    current.__typename !== "LabeledEvent" &&
                    current.__typename !== "UnlabeledEvent"
                ) {
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

export { aggregateEvents, filterTimelineEvents };
