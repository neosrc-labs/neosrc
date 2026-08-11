import { createHmac } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the DB, env, and Next request-scope modules so importing the route and
// the cache module it depends on doesn't touch a real postgres connection.
const { dbMock, deleteWhereMock } = vi.hoisted(() => {
    const deleteWhere = vi.fn();
    return {
        dbMock: {
            delete: vi.fn(() => ({ where: deleteWhere })),
        },
        deleteWhereMock: deleteWhere,
    };
});

vi.mock("~/env", () => ({ env: { GITHUB_WEBHOOK_SECRET: "webhook-secret" } }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("~/server/db", () => ({ db: dbMock }));

import { POST } from "./route";

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

function deletedCountPattern(): string | undefined {
    const condition = deleteWhereMock.mock.calls[0]?.[0];
    if (!condition) return undefined;
    const { params } = new PgDialect().sqlToQuery(condition);
    return params[0] as string;
}

beforeEach(() => {
    dbMock.delete.mockClear();
    deleteWhereMock.mockClear();
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
