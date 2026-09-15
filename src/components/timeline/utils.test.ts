import { describe, expect, it } from "vitest";
import type { GQLTimelineEvent } from "~/server/github-graphql";
import { aggregateEvents, approvalHasWriteAccess } from "./utils";

const ANN = {
    __typename: "User",
    login: "ann",
    avatarUrl: "https://avatars/ann",
    url: "https://codeberg.org/ann",
};
const BOB = {
    __typename: "User",
    login: "bob",
    avatarUrl: "https://avatars/bob",
    url: "https://codeberg.org/bob",
};

function labeled(
    actor: typeof ANN,
    labelName: string,
    createdAt: string,
): GQLTimelineEvent {
    return {
        __typename: "LabeledEvent",
        id: `evt-${labelName}-${createdAt}`,
        actor,
        createdAt,
        label: { name: labelName, color: "f00", description: null },
    };
}

describe("aggregateEvents label grouping", () => {
    it("groups consecutive label changes by the same actor", () => {
        const wrappers = aggregateEvents([
            labeled(ANN, "bug", "2026-01-01T10:00:00Z"),
            labeled(ANN, "docs", "2026-01-01T10:05:00Z"),
        ]);

        expect(wrappers).toHaveLength(1);
        expect(wrappers[0]).toMatchObject({
            type: "aggregated-label",
            actor: ANN,
        });
        expect(
            wrappers[0]?.type === "aggregated-label"
                ? wrappers[0].changes.map((c) => c.label.name)
                : [],
        ).toEqual(["bug", "docs"]);
    });

    it("starts a new group when the actor changes", () => {
        const wrappers = aggregateEvents([
            labeled(ANN, "bug", "2026-01-01T10:00:00Z"),
            labeled(BOB, "wip", "2026-01-01T10:01:00Z"),
        ]);

        expect(wrappers).toHaveLength(2);
        const actors = wrappers.map((w) =>
            w.type === "aggregated-label" ? w.actor.login : null,
        );
        expect(actors).toEqual(["ann", "bob"]);
        expect(
            wrappers[1]?.type === "aggregated-label"
                ? wrappers[1].changes.map((c) => c.label.name)
                : [],
        ).toEqual(["wip"]);
    });
});

describe("approvalHasWriteAccess", () => {
    it("is true for admin and write permissions", () => {
        expect(approvalHasWriteAccess("admin")).toBe(true);
        expect(approvalHasWriteAccess("write")).toBe(true);
    });

    it("is false for read and no access", () => {
        expect(approvalHasWriteAccess("read")).toBe(false);
        expect(approvalHasWriteAccess("none")).toBe(false);
    });

    it("keeps the green check when the permission is unknown", () => {
        expect(approvalHasWriteAccess(undefined)).toBe(true);
    });
});
