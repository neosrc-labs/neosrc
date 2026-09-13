import { describe, expect, it } from "vitest";
import {
    codebergCommentIds,
    mapCodebergTimelineEvents,
} from "~/server/api/routers/issues/codeberg-timeline";
import type { CodebergTimelineEntry } from "~/server/codeberg";
import type { GQLTimelineEvent } from "~/server/github-graphql";

const USER = {
    id: 1,
    login: "ann",
    avatar_url: "https://avatars/ann",
    html_url: "https://codeberg.org/ann",
};

function entry(
    overrides: Partial<CodebergTimelineEntry> = {},
): CodebergTimelineEntry {
    return {
        id: 1,
        type: "comment",
        body: "",
        created_at: "2026-01-01T00:00:00Z",
        user: USER,
        label: null,
        milestone: null,
        assignee: null,
        ...overrides,
    };
}

function only(entry: CodebergTimelineEntry): GQLTimelineEvent {
    const events = mapCodebergTimelineEvents([entry]);
    expect(events).toHaveLength(1);
    const event = events[0];
    if (!event) throw new Error("expected one mapped event");
    return event;
}

describe("mapCodebergTimelineEvents", () => {
    it("maps a comment to an IssueComment with the actor url and empty reactions", () => {
        const event = only(entry({ id: 12, body: "hello" }));

        expect(event).toMatchObject({
            __typename: "IssueComment",
            id: "12",
            databaseId: 12,
            body: "hello",
            authorAssociation: "NONE",
            isMinimized: false,
            minimizedReason: null,
            reactions: { nodes: [] },
        });
        if (event.__typename !== "IssueComment") {
            throw new Error("expected an IssueComment");
        }
        expect(event.author).toEqual({
            __typename: "User",
            login: "ann",
            avatarUrl: "https://avatars/ann",
            url: "https://codeberg.org/ann",
        });
    });

    it("maps close and reopen to state events", () => {
        expect(only(entry({ type: "close" })).__typename).toBe("ClosedEvent");
        expect(only(entry({ type: "reopen" })).__typename).toBe(
            "ReopenedEvent",
        );
    });

    it("distinguishes added from removed labels by body", () => {
        const label = { id: 3, name: "bug", color: "d73a4a" };

        expect(
            only(entry({ id: 12, type: "label", body: "1", label })),
        ).toMatchObject({
            __typename: "LabeledEvent",
            id: "12",
            label: { name: "bug", color: "d73a4a", description: null },
        });

        expect(
            only(entry({ id: 13, type: "label", body: "", label })),
        ).toMatchObject({
            __typename: "UnlabeledEvent",
            id: "13",
            label: { name: "bug", color: "d73a4a", description: null },
        });
    });

    it("maps milestone changes to the new milestone when both fields are present", () => {
        expect(
            only(
                entry({
                    type: "milestone",
                    milestone: { id: 4, title: "v2" },
                    old_milestone: { id: 3, title: "v1" },
                }),
            ),
        ).toMatchObject({
            __typename: "MilestonedEvent",
            milestoneTitle: "v2",
        });

        expect(
            only(
                entry({
                    type: "milestone",
                    old_milestone: { id: 3, title: "v1" },
                }),
            ),
        ).toMatchObject({
            __typename: "DemilestonedEvent",
            milestoneTitle: "v1",
        });
    });

    it("maps assignee changes and keeps the assignee url", () => {
        const assignee = {
            id: 7,
            login: "bo",
            avatar_url: "b",
            html_url: "u",
        };

        const assigned = only(entry({ type: "assignees", assignee }));
        if (assigned.__typename !== "AssignedEvent") {
            throw new Error("expected an AssignedEvent");
        }
        expect(assigned.actor?.login).toBe("ann");
        expect(assigned.assignee?.url).toBe("u");

        const unassigned = only(
            entry({ type: "assignees", assignee, removed_assignee: true }),
        );
        if (unassigned.__typename !== "UnassignedEvent") {
            throw new Error("expected an UnassignedEvent");
        }
        expect(unassigned.assignee?.url).toBe("u");
    });

    it("maps title changes and lock events", () => {
        expect(
            only(
                entry({
                    type: "change_title",
                    old_title: "before",
                    new_title: "after",
                }),
            ),
        ).toMatchObject({
            __typename: "RenamedTitleEvent",
            previousTitle: "before",
            currentTitle: "after",
        });

        expect(only(entry({ type: "lock" }))).toMatchObject({
            __typename: "LockedEvent",
            lockReason: null,
        });
        expect(only(entry({ type: "unlock" })).__typename).toBe(
            "UnlockedEvent",
        );
    });

    it("drops unsupported entries and incomplete label/milestone changes", () => {
        const events = mapCodebergTimelineEvents([
            entry({ type: "commit_ref" }),
            entry({ type: "issue_ref" }),
            entry({ type: "unknown_type" }),
            entry({ type: "label", body: "1", label: null }),
            entry({ type: "milestone" }),
        ]);

        expect(events).toEqual([]);
    });
});

describe("codebergCommentIds", () => {
    it("returns only comment entry ids in order", () => {
        expect(
            codebergCommentIds([
                entry({ id: 3, type: "comment" }),
                entry({ id: 4, type: "label", body: "1" }),
                entry({ id: 5, type: "comment" }),
            ]),
        ).toEqual([3, 5]);
    });
});
