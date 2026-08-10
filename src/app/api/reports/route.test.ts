import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, POST, PUT } from "~/app/api/reports/route";

const envState = vi.hoisted(() => ({
    NODE_ENV: "test",
    ALLOW_UNAUTHENTICATED_REPORTS: undefined as string | undefined,
}));

const mocks = vi.hoisted(() => ({
    db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
    insertValues: vi.fn(),
    verifyGitHubOIDCToken: vi.fn(),
    verifyApiKey: vi.fn(),
    checkReportPermission: vi.fn(),
}));

vi.mock("~/env", () => ({ env: envState }));

vi.mock("~/server/db", () => ({ db: mocks.db }));

vi.mock("~/server/auth/github-oidc", () => ({
    verifyGitHubOIDCToken: mocks.verifyGitHubOIDCToken,
}));

vi.mock("~/server/api-keys", () => ({
    KEY_PREFIX: "neo_",
    verifyApiKey: mocks.verifyApiKey,
    checkReportPermission: mocks.checkReportPermission,
}));

interface ReportBody {
    provider: "github" | "codeberg";
    repository: string;
    prNumber: number;
    name: string;
    title: string;
    type: "markdown";
    data: string;
    description?: string;
    commitSha?: string;
    sourceUrl?: string;
}

function validReportBody(
    provider: "github" | "codeberg" = "github",
): ReportBody {
    return {
        provider,
        repository: "owner/repo",
        prNumber: 42,
        name: "lint",
        title: "Lint report",
        type: "markdown",
        data: "all good",
    };
}

function apiRequest(
    method: "PUT" | "POST" | "DELETE",
    body: unknown,
    headers: Record<string, string> = {},
) {
    return new Request("http://localhost/api/reports", {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
}

function selectChain(rows: unknown[]) {
    return {
        from: () => ({
            where: () => ({
                orderBy: () => ({
                    limit: () => Promise.resolve(rows),
                }),
            }),
        }),
    };
}

function updateChain() {
    return {
        set: () => ({
            where: () => Promise.resolve(),
        }),
    };
}

function uniqueViolation() {
    return Object.assign(
        new Error("duplicate key value violates unique constraint"),
        { code: "23505" },
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "test";
    envState.ALLOW_UNAUTHENTICATED_REPORTS = undefined;
    mocks.verifyGitHubOIDCToken.mockRejectedValue(new Error("token rejected"));
    mocks.db.select.mockReturnValue(selectChain([]));
    mocks.db.insert.mockImplementation(() => ({ values: mocks.insertValues }));
    mocks.insertValues.mockResolvedValue({});
    mocks.db.update.mockReturnValue(updateChain());
});

const unauthenticatedCases: Array<
    ["github" | "codeberg", "PUT" | "POST" | "DELETE"]
> = [
    ["github", "PUT"],
    ["codeberg", "PUT"],
    ["github", "POST"],
    ["codeberg", "POST"],
    ["github", "DELETE"],
    ["codeberg", "DELETE"],
];

describe("authentication", () => {
    it.each(unauthenticatedCases)(
        "rejects unauthenticated %s %s with 401",
        async (provider, method) => {
            const handler =
                method === "PUT" ? PUT : method === "POST" ? POST : DELETE;
            const body =
                method === "POST"
                    ? {
                          provider,
                          repository: "owner/repo",
                          prNumber: 42,
                          name: "lint",
                          state: "VALID",
                      }
                    : method === "DELETE"
                      ? {
                            provider,
                            repository: "owner/repo",
                            prNumber: 42,
                            name: "lint",
                        }
                      : validReportBody(provider);

            const res = await handler(apiRequest(method, body));

            expect(res.status).toBe(401);
        },
    );

    describe("github OIDC flow", () => {
        it("accepts a valid OIDC token matching the repository", async () => {
            mocks.verifyGitHubOIDCToken.mockResolvedValue({
                repository: "owner/repo",
            });

            const res = await PUT(
                apiRequest("PUT", validReportBody("github"), {
                    authorization: "Bearer oidc-token",
                }),
            );

            expect(res.status).toBe(200);
            expect(mocks.verifyGitHubOIDCToken).toHaveBeenCalledWith(
                "oidc-token",
            );
            expect(mocks.insertValues).toHaveBeenCalledTimes(1);
        });

        it("rejects a token for a different repository with 403", async () => {
            mocks.verifyGitHubOIDCToken.mockResolvedValue({
                repository: "other/repo",
            });

            const res = await PUT(
                apiRequest("PUT", validReportBody("github"), {
                    authorization: "Bearer oidc-token",
                }),
            );

            expect(res.status).toBe(403);
            expect(mocks.insertValues).not.toHaveBeenCalled();
        });

        it("rejects an invalid token with 401", async () => {
            mocks.verifyGitHubOIDCToken.mockRejectedValue(
                new Error("bad token"),
            );

            const res = await PUT(
                apiRequest("PUT", validReportBody("github"), {
                    authorization: "Bearer oidc-token",
                }),
            );

            expect(res.status).toBe(401);
            expect(mocks.insertValues).not.toHaveBeenCalled();
        });
    });

    describe("API key flow", () => {
        it("accepts an API key with permission", async () => {
            mocks.verifyApiKey.mockResolvedValue({
                key: { id: "key-1" },
                permissions: [],
            });
            mocks.checkReportPermission.mockReturnValue(true);

            const res = await PUT(
                apiRequest("PUT", validReportBody("codeberg"), {
                    authorization: "Bearer neo_testkey",
                }),
            );

            expect(res.status).toBe(200);
            expect(mocks.checkReportPermission).toHaveBeenCalledWith(
                [],
                "codeberg",
                "owner/repo",
            );
        });

        it("rejects an API key without permission with 403", async () => {
            mocks.verifyApiKey.mockResolvedValue({
                key: { id: "key-1" },
                permissions: [],
            });
            mocks.checkReportPermission.mockReturnValue(false);

            const res = await PUT(
                apiRequest("PUT", validReportBody("github"), {
                    authorization: "Bearer neo_testkey",
                }),
            );

            expect(res.status).toBe(403);
            expect(mocks.insertValues).not.toHaveBeenCalled();
        });

        it("rejects an invalid API key with 401", async () => {
            mocks.verifyApiKey.mockResolvedValue(null);

            const res = await PUT(
                apiRequest("PUT", validReportBody("github"), {
                    authorization: "Bearer neo_badkey",
                }),
            );

            expect(res.status).toBe(401);
            expect(mocks.insertValues).not.toHaveBeenCalled();
        });

        it("rejects a non-key bearer token on codeberg with 401", async () => {
            const res = await PUT(
                apiRequest("PUT", validReportBody("codeberg"), {
                    authorization: "Bearer not-an-api-key",
                }),
            );

            expect(res.status).toBe(401);
            expect(mocks.verifyApiKey).not.toHaveBeenCalled();
        });
    });

    describe("development bypass flag", () => {
        it("still requires credentials in development without the flag", async () => {
            envState.NODE_ENV = "development";

            const res = await PUT(apiRequest("PUT", validReportBody("github")));

            expect(res.status).toBe(401);
        });

        it("allows unauthenticated writes for both providers when the flag is set in development", async () => {
            envState.NODE_ENV = "development";
            envState.ALLOW_UNAUTHENTICATED_REPORTS = "true";

            const githubRes = await PUT(
                apiRequest("PUT", validReportBody("github")),
            );
            const codebergRes = await PUT(
                apiRequest("PUT", validReportBody("codeberg")),
            );

            expect(githubRes.status).toBe(200);
            expect(codebergRes.status).toBe(200);
        });

        it("ignores the flag outside development", async () => {
            envState.NODE_ENV = "production";
            envState.ALLOW_UNAUTHENTICATED_REPORTS = "true";

            const res = await PUT(apiRequest("PUT", validReportBody("github")));

            expect(res.status).toBe(401);
        });
    });
});

describe("payload bounds", () => {
    it("rejects a data field over 1,000,000 chars with 400", async () => {
        const body = validReportBody();
        body.data = "x".repeat(1_000_001);

        const res = await PUT(apiRequest("PUT", body));

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({
            error: "Validation failed",
            issues: { data: expect.any(Array) },
        });
    });

    type OversizedField =
        | "repository"
        | "name"
        | "title"
        | "description"
        | "commitSha"
        | "sourceUrl";
    const oversizedCases: Array<[OversizedField, string]> = [
        ["repository", "r".repeat(256)],
        ["name", "n".repeat(256)],
        ["title", "t".repeat(256)],
        ["description", "d".repeat(100_001)],
        ["commitSha", "c".repeat(41)],
        ["sourceUrl", "u".repeat(2049)],
    ];

    it.each(oversizedCases)(
        "rejects an oversized %s with 400",
        async (field, value) => {
            const body = validReportBody();
            body[field] = value;

            const res = await PUT(apiRequest("PUT", body));

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({
                error: "Validation failed",
                issues: { [field]: expect.any(Array) },
            });
        },
    );

    it("accepts boundary-length values", async () => {
        envState.NODE_ENV = "development";
        envState.ALLOW_UNAUTHENTICATED_REPORTS = "true";
        const body = validReportBody();
        body.repository = "r".repeat(255);
        body.name = "n".repeat(255);
        body.title = "t".repeat(255);
        body.description = "d".repeat(100_000);
        body.commitSha = "c".repeat(40);
        body.sourceUrl = "u".repeat(2048);
        body.data = "x".repeat(1_000_000);

        const res = await PUT(apiRequest("PUT", body));

        expect(res.status).toBe(200);
    });

    it("rejects a body larger than 2MB with 413", async () => {
        const res = await PUT(
            apiRequest("PUT", validReportBody(), {
                "content-length": "3000000",
            }),
        );

        expect(res.status).toBe(413);
        expect(mocks.insertValues).not.toHaveBeenCalled();
    });

    it("allows a body at exactly the 2MB limit", async () => {
        envState.NODE_ENV = "development";
        envState.ALLOW_UNAUTHENTICATED_REPORTS = "true";

        const res = await PUT(
            apiRequest("PUT", validReportBody(), {
                "content-length": String(2 * 1024 * 1024),
            }),
        );

        expect(res.status).toBe(200);
    });

    it("rejects a body over 2MB even without a Content-Length header", async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    new TextEncoder().encode("x".repeat(3 * 1024 * 1024)),
                );
                controller.close();
            },
        });

        const init = {
            method: "PUT",
            body: stream,
            duplex: "half" as const,
        };
        const res = await PUT(
            new Request("http://localhost/api/reports", init),
        );

        expect(res.status).toBe(413);
        expect(mocks.insertValues).not.toHaveBeenCalled();
    });

    it("rejects invalid JSON with 400", async () => {
        const res = await PUT(
            new Request("http://localhost/api/reports", {
                method: "PUT",
                body: "{not json",
            }),
        );

        expect(res.status).toBe(400);
    });
});

describe("concurrent uploads", () => {
    it("retries on a primary-key conflict and inserts the next revision", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });
        mocks.db.select
            .mockReturnValueOnce(selectChain([]))
            .mockReturnValueOnce(selectChain([{ revision: 1 }]))
            .mockReturnValue(selectChain([]));
        mocks.insertValues
            .mockRejectedValueOnce(uniqueViolation())
            .mockResolvedValueOnce({});

        const res = await PUT(
            apiRequest("PUT", validReportBody("github"), {
                authorization: "Bearer oidc-token",
            }),
        );

        expect(res.status).toBe(200);
        expect(mocks.insertValues).toHaveBeenCalledTimes(2);
        const revisions = mocks.insertValues.mock.calls.map((call) => {
            const values = call[0];
            return values.revision;
        });
        expect(revisions).toEqual([1, 2]);
    });

    it("returns 409 when conflicts exhaust the retry budget", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });
        mocks.db.select.mockReturnValue(selectChain([]));
        mocks.insertValues.mockRejectedValue(uniqueViolation());

        const res = await PUT(
            apiRequest("PUT", validReportBody("github"), {
                authorization: "Bearer oidc-token",
            }),
        );

        expect(res.status).toBe(409);
        expect(mocks.insertValues).toHaveBeenCalledTimes(3);
    });
});

describe("POST and DELETE", () => {
    it("POST updates the latest revision's state", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });
        mocks.db.select.mockReturnValue(
            selectChain([
                {
                    provider: "github",
                    repositorySlug: "owner/repo",
                    prNumber: 42,
                    revision: 3,
                    name: "lint",
                },
            ]),
        );

        const res = await POST(
            apiRequest(
                "POST",
                {
                    provider: "github",
                    repository: "owner/repo",
                    prNumber: 42,
                    name: "lint",
                    state: "OUTDATED",
                },
                { authorization: "Bearer oidc-token" },
            ),
        );

        expect(res.status).toBe(200);
        expect(mocks.db.update).toHaveBeenCalledTimes(1);
    });

    it("POST returns 404 when the report does not exist", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });

        const res = await POST(
            apiRequest(
                "POST",
                {
                    provider: "github",
                    repository: "owner/repo",
                    prNumber: 42,
                    name: "lint",
                    state: "VALID",
                },
                { authorization: "Bearer oidc-token" },
            ),
        );

        expect(res.status).toBe(404);
    });

    it("DELETE tombstones the latest revision", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });
        mocks.db.select.mockReturnValue(
            selectChain([
                {
                    provider: "github",
                    repositorySlug: "owner/repo",
                    prNumber: 42,
                    revision: 3,
                    name: "lint",
                    title: "Lint report",
                },
            ]),
        );

        const res = await DELETE(
            apiRequest(
                "DELETE",
                {
                    provider: "github",
                    repository: "owner/repo",
                    prNumber: 42,
                    name: "lint",
                },
                { authorization: "Bearer oidc-token" },
            ),
        );

        expect(res.status).toBe(200);
        const values = mocks.insertValues.mock.calls[0]?.[0];
        expect(values.revision).toBe(4);
        expect(values.state).toBe("REMOVED");
        expect(values.type).toBe("tombstone");
    });

    it("DELETE retries a tombstone insert on conflict", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });
        mocks.db.select
            .mockReturnValueOnce(
                selectChain([
                    {
                        provider: "github",
                        repositorySlug: "owner/repo",
                        prNumber: 42,
                        revision: 3,
                        name: "lint",
                        title: "Lint report",
                    },
                ]),
            )
            .mockReturnValueOnce(
                selectChain([
                    {
                        provider: "github",
                        repositorySlug: "owner/repo",
                        prNumber: 42,
                        revision: 3,
                        name: "lint",
                        title: "Lint report",
                    },
                ]),
            )
            .mockReturnValueOnce(
                selectChain([
                    {
                        provider: "github",
                        repositorySlug: "owner/repo",
                        prNumber: 42,
                        revision: 4,
                        name: "lint",
                        title: "Lint report",
                    },
                ]),
            )
            .mockReturnValue(selectChain([]));
        mocks.insertValues
            .mockRejectedValueOnce(uniqueViolation())
            .mockResolvedValueOnce({});

        const res = await DELETE(
            apiRequest(
                "DELETE",
                {
                    provider: "github",
                    repository: "owner/repo",
                    prNumber: 42,
                    name: "lint",
                },
                { authorization: "Bearer oidc-token" },
            ),
        );

        expect(res.status).toBe(200);
        expect(mocks.insertValues).toHaveBeenCalledTimes(2);
        const revisions = mocks.insertValues.mock.calls.map((call) => {
            const values = call[0];
            return values.revision;
        });
        expect(revisions).toEqual([4, 5]);
    });

    it("DELETE returns 404 when the report does not exist", async () => {
        mocks.verifyGitHubOIDCToken.mockResolvedValue({
            repository: "owner/repo",
        });

        const res = await DELETE(
            apiRequest(
                "DELETE",
                {
                    provider: "github",
                    repository: "owner/repo",
                    prNumber: 42,
                    name: "lint",
                },
                { authorization: "Bearer oidc-token" },
            ),
        );

        expect(res.status).toBe(404);
    });
});
