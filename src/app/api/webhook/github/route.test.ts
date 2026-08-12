import { createHmac } from "node:crypto";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the DB, env, auth, sync, and Next request-scope modules so importing
// the route and the modules it depends on doesn't touch a real postgres
// connection or the network.
const { dbMock, deleteWhereMock, selectWhereMock, selectLimitMock, afterMock } =
    vi.hoisted(() => {
        const deleteWhere = vi.fn();
        const selectLimit = vi.fn(
            async (): Promise<{ userId: string }[]> => [],
        );
        const selectWhere = vi.fn((_condition: SQL) => ({
            limit: selectLimit,
        }));
        return {
            dbMock: {
                delete: vi.fn(() => ({ where: deleteWhere })),
                select: vi.fn(() => ({
                    from: vi.fn(() => ({ where: selectWhere })),
                })),
            },
            deleteWhereMock: deleteWhere,
            selectWhereMock: selectWhere,
            selectLimitMock: selectLimit,
            afterMock: vi.fn(),
        };
    });

vi.mock("~/env", () => ({ env: { GITHUB_WEBHOOK_SECRET: "webhook-secret" } }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("~/server/db", () => ({ db: dbMock }));
vi.mock("~/server/auth", () => ({
    getGitHubToken: vi.fn(),
    isAnonymousToken: vi.fn(),
}));
vi.mock("~/server/sync", () => ({ syncCurrentUser: vi.fn() }));

import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import { syncCurrentUser } from "~/server/sync";

import { POST } from "./route";

const getGitHubTokenMock = vi.mocked(getGitHubToken);
const isAnonymousTokenMock = vi.mocked(isAnonymousToken);
const syncCurrentUserMock = vi.mocked(syncCurrentUser);

const SECRET = "webhook-secret";

function signedRequest(event: string, payload: object): Request {
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", SECRET)
        .update(body)
        .digest("hex")}`;
    return new Request("http://localhost/api/webhook/github", {
        method: "POST",
        headers: {
            "x-github-event": event,
            "x-github-delivery": "test-delivery",
            "x-hub-signature-256": signature,
        },
        body,
    });
}

function issuePayload(owner: string, repo: string, action: string): object {
    return {
        action,
        issue: { number: 1 },
        repository: { full_name: `${owner}/${repo}` },
    };
}

function memberPayload(memberId: number, login: string): object {
    return {
        action: "added",
        member: { id: memberId, login },
        repository: { full_name: "neosrc/web" },
        sender: { id: 1, login: "owner" },
    };
}

/** Params of the single account lookup where clause, for matching the query. */
function selectWhereParams(): string[] | undefined {
    const condition = selectWhereMock.mock.calls[0]?.[0];
    if (!condition) return undefined;
    const { params } = new PgDialect().sqlToQuery(condition);
    return params as string[];
}

function deletedCountPattern(): string | undefined {
    const condition = deleteWhereMock.mock.calls[0]?.[0];
    if (!condition) return undefined;
    const { params } = new PgDialect().sqlToQuery(condition);
    return params[0] as string;
}

/**
 * Runs the callbacks the member branch scheduled via next/server's after(),
 * so tests observe the deferred sync deterministically.
 */
async function flushAfterCallbacks(): Promise<void> {
    for (const [callback] of afterMock.mock.calls) {
        await callback();
    }
}

beforeEach(() => {
    dbMock.delete.mockClear();
    deleteWhereMock.mockClear();
    afterMock.mockClear();
});

describe("webhook event routing", () => {
    it("invalidates issue/PR counts when an issue is opened", async () => {
        const res = await POST(
            signedRequest("issues", issuePayload("neosrc", "web", "opened")),
        );

        expect(res.status).toBe(200);
        expect(dbMock.delete).toHaveBeenCalledTimes(1);
        expect(deletedCountPattern()).toBe("gh:counts:%:neosrc:web");
    });

    it("invalidates issue/PR counts when a pull request is closed", async () => {
        const res = await POST(
            signedRequest(
                "pull_request",
                issuePayload("neosrc", "web", "closed"),
            ),
        );

        expect(res.status).toBe(200);
        expect(deletedCountPattern()).toBe("gh:counts:%:neosrc:web");
    });

    it("invalidates counts for a reopened issue", async () => {
        const res = await POST(
            signedRequest("issues", issuePayload("neosrc", "web", "reopened")),
        );

        expect(res.status).toBe(200);
        expect(deletedCountPattern()).toBe("gh:counts:%:neosrc:web");
    });

    it("escapes LIKE wildcards in the repo name", async () => {
        await POST(
            signedRequest(
                "issues",
                issuePayload("neosrc", "my_repo", "opened"),
            ),
        );

        expect(deletedCountPattern()).toBe("gh:counts:%:neosrc:my\\_repo");
    });

    it("ignores issues events that do not change open counts", async () => {
        const res = await POST(
            signedRequest("issues", issuePayload("neosrc", "web", "labeled")),
        );

        expect(res.status).toBe(200);
        expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it("ignores events of other types", async () => {
        const res = await POST(
            signedRequest("push", { ref: "refs/heads/main" }),
        );

        expect(res.status).toBe(200);
        expect(dbMock.delete).not.toHaveBeenCalled();
    });

    it("rejects requests with an invalid signature", async () => {
        const body = JSON.stringify(issuePayload("neosrc", "web", "opened"));
        const res = await POST(
            new Request("http://localhost/api/webhook/github", {
                method: "POST",
                headers: {
                    "x-github-event": "issues",
                    "x-github-delivery": "test-delivery",
                    "x-hub-signature-256": "sha256=invalid",
                },
                body,
            }),
        );

        expect(res.status).toBe(401);
        expect(dbMock.delete).not.toHaveBeenCalled();
    });
});

describe("member event webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectLimitMock.mockResolvedValue([]);
        getGitHubTokenMock.mockResolvedValue("gh-token");
        isAnonymousTokenMock.mockReturnValue(false);
        syncCurrentUserMock.mockResolvedValue({
            accountsUpserted: 0,
            reposUpserted: 0,
            relationsWritten: 0,
            relationsRemoved: 0,
            teamsSkipped: 0,
        });
    });

    it("forces a full sync for the member when they are one of our users", async () => {
        selectLimitMock.mockResolvedValue([{ userId: "user-1" }]);

        const res = await POST(
            signedRequest("member", memberPayload(9876, "collaborator")),
        );
        await flushAfterCallbacks();

        expect(res.status).toBe(200);
        expect(selectWhereParams()).toEqual(["github", "9876"]);
        expect(syncCurrentUserMock).toHaveBeenCalledWith(expect.anything(), {
            provider: "github",
            accessToken: "gh-token",
            userId: "user-1",
            forceFull: true,
        });
    });

    it("does nothing when the member is not one of our users", async () => {
        const res = await POST(
            signedRequest("member", memberPayload(9876, "collaborator")),
        );
        await flushAfterCallbacks();

        expect(res.status).toBe(200);
        expect(getGitHubTokenMock).not.toHaveBeenCalled();
        expect(syncCurrentUserMock).not.toHaveBeenCalled();
    });

    it("skips the sync when the user only has the anonymous token", async () => {
        selectLimitMock.mockResolvedValue([{ userId: "user-1" }]);
        isAnonymousTokenMock.mockReturnValue(true);

        const res = await POST(
            signedRequest("member", memberPayload(9876, "collaborator")),
        );
        await flushAfterCallbacks();

        expect(res.status).toBe(200);
        expect(syncCurrentUserMock).not.toHaveBeenCalled();
    });

    it("rejects a member event with an invalid signature before any lookup", async () => {
        const body = JSON.stringify(memberPayload(9876, "collaborator"));
        const res = await POST(
            new Request("http://localhost/api/webhook/github", {
                method: "POST",
                headers: {
                    "x-github-event": "member",
                    "x-github-delivery": "test-delivery",
                    "x-hub-signature-256": "sha256=invalid",
                },
                body,
            }),
        );

        expect(res.status).toBe(401);
        expect(selectWhereMock).not.toHaveBeenCalled();
        expect(syncCurrentUserMock).not.toHaveBeenCalled();
    });

    it("still acks the webhook when the forced sync fails", async () => {
        selectLimitMock.mockResolvedValue([{ userId: "user-1" }]);
        syncCurrentUserMock.mockRejectedValue(new Error("sync exploded"));

        const res = await POST(
            signedRequest("member", memberPayload(9876, "collaborator")),
        );
        await flushAfterCallbacks();

        expect(res.status).toBe(200);
        expect(syncCurrentUserMock).toHaveBeenCalledTimes(1);
    });

    it("ignores non-member events without touching the account lookup", async () => {
        await POST(
            signedRequest("issues", issuePayload("neosrc", "web", "opened")),
        );

        expect(selectWhereMock).not.toHaveBeenCalled();
        expect(syncCurrentUserMock).not.toHaveBeenCalled();
    });
});
