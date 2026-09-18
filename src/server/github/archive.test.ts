import { describe, expect, it } from "vitest";
import {
    mapPullRequestArchive,
    type RestIssueEvent,
} from "~/server/github/archive";

const ACTOR = {
    login: "admin",
    avatar_url: "https://avatars/admin",
    html_url: "https://github.com/admin",
    type: "User",
};

function event(overrides: Partial<RestIssueEvent> = {}): RestIssueEvent {
    return {
        id: 1,
        node_id: "ARE_1",
        event: "archived",
        created_at: "2026-01-01T10:00:00Z",
        actor: ACTOR,
        ...overrides,
    };
}

describe("mapPullRequestArchive", () => {
    it("maps an archived event to the shared timeline shape", () => {
        const archive = mapPullRequestArchive([
            event({ id: 7, node_id: "ARE_7" }),
        ]);

        expect(archive.archived).toBe(true);
        expect(archive.archiveEvents).toEqual([
            {
                __typename: "ArchivedEvent",
                id: "ARE_7",
                actor: {
                    __typename: "User",
                    login: "admin",
                    avatarUrl: "https://avatars/admin",
                    url: "https://github.com/admin",
                },
                createdAt: "2026-01-01T10:00:00Z",
            },
        ]);
    });

    it("ignores events that are not about archiving", () => {
        const archive = mapPullRequestArchive([
            event({ id: 1, event: "closed" }),
            event({ id: 2, event: "locked" }),
        ]);

        expect(archive).toEqual({ archived: false, archiveEvents: [] });
    });

    it("reports the state of the newest event", () => {
        const archive = mapPullRequestArchive([
            event({ id: 1, node_id: "ARE_1" }),
            event({
                id: 2,
                node_id: "ARE_2",
                event: "unarchived",
                created_at: "2026-01-02T10:00:00Z",
            }),
        ]);

        expect(archive.archived).toBe(false);
        expect(archive.archiveEvents.map((e) => e.__typename)).toEqual([
            "ArchivedEvent",
            "UnarchivedEvent",
        ]);
    });

    it("drops the actor when GitHub does not report one", () => {
        const archive = mapPullRequestArchive([event({ actor: null })]);

        expect(archive.archiveEvents[0]?.actor).toBeNull();
    });
});
