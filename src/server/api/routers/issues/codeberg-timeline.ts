/**
 * Forgejo issue timeline -> shared timeline events.
 *
 * The shared timeline renderers (timeline/event.tsx and timeline/content/*)
 * consume `GQLTimelineEvent`. This module is the only place Forgejo entries
 * are translated into that shape, so both providers render through the same
 * components and no provider-specific data leaks into the renderers.
 */
import type { CodebergTimelineEntry } from "~/server/codeberg";
import type {
    GQLActor,
    GQLLabel,
    GQLTimelineEvent,
} from "~/server/github-graphql";

function mapActor(user: CodebergTimelineEntry["user"]): GQLActor | null {
    if (!user) return null;
    return {
        __typename: "User",
        login: user.login,
        avatarUrl: user.avatar_url,
        url: user.html_url,
    };
}

function mapLabel(
    label: NonNullable<CodebergTimelineEntry["label"]>,
): GQLLabel {
    return {
        name: label.name,
        color: label.color,
        description: label.description ?? null,
    };
}

export function mapCodebergTimelineEvents(
    entries: CodebergTimelineEntry[],
): GQLTimelineEvent[] {
    const events: GQLTimelineEvent[] = [];

    for (const entry of entries) {
        const base = {
            id: String(entry.id),
            actor: mapActor(entry.user),
            createdAt: entry.created_at,
        };

        switch (entry.type) {
            case "comment":
                events.push({
                    __typename: "IssueComment",
                    ...base,
                    databaseId: entry.id,
                    body: entry.body,
                    author: base.actor,
                    authorAssociation: "NONE",
                    isMinimized: false,
                    minimizedReason: null,
                    reactions: { nodes: [] },
                });
                break;
            case "close":
                events.push({ __typename: "ClosedEvent", ...base });
                break;
            case "reopen":
                events.push({ __typename: "ReopenedEvent", ...base });
                break;
            case "label": {
                if (!entry.label) break;
                const label = mapLabel(entry.label);
                // Forgejo writes "1" when adding a label and "" when removing.
                if (entry.body === "1") {
                    events.push({
                        __typename: "LabeledEvent",
                        ...base,
                        label,
                    });
                } else {
                    events.push({
                        __typename: "UnlabeledEvent",
                        ...base,
                        label,
                    });
                }
                break;
            }
            case "milestone": {
                // A change carrying both fields is a move; show the new
                // milestone, matching the GitHub renderer.
                if (entry.milestone) {
                    events.push({
                        __typename: "MilestonedEvent",
                        ...base,
                        milestoneTitle: entry.milestone.title,
                    });
                } else if (entry.old_milestone) {
                    events.push({
                        __typename: "DemilestonedEvent",
                        ...base,
                        milestoneTitle: entry.old_milestone.title,
                    });
                }
                break;
            }
            case "assignees": {
                const assignee = mapActor(entry.assignee);
                if (entry.removed_assignee === true) {
                    events.push({
                        __typename: "UnassignedEvent",
                        ...base,
                        assignee,
                    });
                } else {
                    events.push({
                        __typename: "AssignedEvent",
                        ...base,
                        assignee,
                    });
                }
                break;
            }
            case "change_title":
                events.push({
                    __typename: "RenamedTitleEvent",
                    ...base,
                    previousTitle: entry.old_title ?? "",
                    currentTitle: entry.new_title ?? "",
                });
                break;
            case "lock":
                events.push({
                    __typename: "LockedEvent",
                    ...base,
                    lockReason: null,
                });
                break;
            case "unlock":
                events.push({ __typename: "UnlockedEvent", ...base });
                break;
        }
    }

    return events;
}

export function codebergCommentIds(entries: CodebergTimelineEntry[]): number[] {
    return entries.filter((entry) => entry.type === "comment").map((e) => e.id);
}
