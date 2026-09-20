import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub everything the router pulls in at import time so the callers run
// against fakes instead of env vars, postgres, or the GitHub/Codeberg APIs.
vi.mock("~/server/db", () => ({ db: {} }));
// Present in every test so a shared browsing token can never leak into the
// viewer's feed; tests may drop it to exercise deployments without one.
const envState = vi.hoisted(() => ({
    sharedToken: "shared-anonymous-token" as string | undefined,
}));
vi.mock("~/env", () => ({
    env: {
        get GITHUB_ANONYMOUS_TOKEN() {
            return envState.sharedToken;
        },
    },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
    getGitHubToken: vi.fn(),
    getCodebergToken: vi.fn(),
    getLinkedAccounts: vi.fn(),
    getProviderTokenRefresh: vi.fn(() => undefined),
}));

const graphqlMock = vi.hoisted(() => vi.fn());
vi.mock("~/server/github/graphql-client", () => ({
    createGraphql: () => graphqlMock,
}));

const searchIssuesAcrossReposMock = vi.hoisted(() => vi.fn());
vi.mock("~/server/codeberg", () => ({
    searchIssuesAcrossRepos: searchIssuesAcrossReposMock,
}));

import { createCallerFactory, createTRPCContext } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    getLinkedAccounts,
    getSession,
} from "~/server/auth";
import { dashboardRouter } from "./index";
import { RECENT_ITEM_LIMIT } from "./types";

const getSessionMock = vi.mocked(getSession);
const getGitHubTokenMock = vi.mocked(getGitHubToken);
const getCodebergTokenMock = vi.mocked(getCodebergToken);
const getLinkedAccountsMock = vi.mocked(getLinkedAccounts);

type GqlVars = { searchQuery: string; first: number };

const GH_PULL = {
    __typename: "PullRequest",
    number: 12,
    title: "GitHub pull",
    isDraft: false,
    updatedAt: "2026-09-14T23:30:00Z",
    comments: { totalCount: 3 },
    repository: { nameWithOwner: "acme/api" },
};

const GH_ISSUE = {
    __typename: "Issue",
    number: 4,
    title: "GitHub issue",
    updatedAt: "2026-09-13T08:00:00Z",
    comments: { totalCount: 0 },
    repository: { nameWithOwner: "acme/api" },
};

/** 01:00+02:00 is 23:00Z on the 14th, i.e. older than GH_PULL despite
 *  sorting after it as a raw string. */
const CB_PULL = {
    number: 7,
    title: "Codeberg pull",
    updated_at: "2026-09-15T01:00:00+02:00",
    comments: 1,
    labels: [],
    pull_request: { merged: false, draft: true },
    repository: { id: 1, name: "site", owner: "acme", full_name: "acme/site" },
};

function ghResponse(typename: "PullRequest" | "Issue") {
    return {
        search: {
            nodes: typename === "PullRequest" ? [GH_PULL] : [GH_ISSUE],
        },
    };
}

async function callerFor(
    session: unknown,
    providerIds: ("github" | "codeberg")[] = session
        ? ["github", "codeberg"]
        : [],
) {
    getSessionMock.mockResolvedValue(session as never);
    getLinkedAccountsMock.mockResolvedValue(
        providerIds.map((providerId) => ({
            id: `${providerId}-account`,
            accountId: `${providerId}-user`,
            providerId,
            username: "octocat",
            connectionStatus: "active" as const,
        })),
    );
    const ctx = await createTRPCContext({ headers: new Headers() });
    return createCallerFactory(dashboardRouter)(ctx);
}

const bothLinked = {
    user: {
        id: "user-1",
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    getGitHubTokenMock.mockResolvedValue("gh-token");
    getCodebergTokenMock.mockResolvedValue("cb-token");
    envState.sharedToken = "shared-anonymous-token";
    graphqlMock.mockImplementation((_doc: string, vars: GqlVars) =>
        Promise.resolve(
            ghResponse(
                vars.searchQuery.startsWith("is:pr") ? "PullRequest" : "Issue",
            ),
        ),
    );
    searchIssuesAcrossReposMock.mockResolvedValue([CB_PULL]);
});

describe("dashboard router", () => {
    it("merges providers newest-first by parsed timestamp", async () => {
        const dashboard = await callerFor(bothLinked);

        const result = await dashboard.recentPulls({ limit: 10 });

        expect(result.unavailable).toEqual([]);
        expect(result.items.map((item) => item.title)).toEqual([
            "GitHub pull",
            "Codeberg pull",
        ]);
        expect(result.items[0]).toMatchObject({
            provider: "gh",
            repo: "acme/api",
            number: 12,
            comments: 3,
        });
        expect(result.items[1]).toMatchObject({
            provider: "cb",
            repo: "acme/site",
            number: 7,
            isDraft: true,
            comments: 1,
        });
    });

    it("truncates after merging, not per provider", async () => {
        searchIssuesAcrossReposMock.mockResolvedValue([
            CB_PULL,
            { ...CB_PULL, number: 6, updated_at: "2026-09-12T01:00:00+02:00" },
        ]);
        const dashboard = await callerFor(bothLinked);

        const result = await dashboard.recentPulls({ limit: 2 });

        expect(result.items.map((item) => item.number)).toEqual([12, 7]);
    });

    it("queries only the requested provider", async () => {
        const dashboard = await callerFor(bothLinked);

        await expect(
            dashboard.recentPulls({ provider: "cb" }),
        ).resolves.toMatchObject({
            items: [{ provider: "cb" }],
        });

        expect(getGitHubTokenMock).not.toHaveBeenCalled();
        expect(searchIssuesAcrossReposMock).toHaveBeenCalledWith("cb-token", {
            type: "pulls",
            state: "open",
            created: true,
            sort: "recentupdate",
            limit: RECENT_ITEM_LIMIT,
        });
    });

    it("asks GitHub for open items only", async () => {
        const dashboard = await callerFor(bothLinked);

        await dashboard.recentPulls({ provider: "gh" });
        await dashboard.recentIssues({ provider: "gh" });

        const queries = graphqlMock.mock.calls.map(
            (call: unknown[]) => (call[1] as GqlVars).searchQuery,
        );
        expect(queries).toEqual([
            "is:pr author:@me is:open sort:updated-desc",
            "is:issue author:@me is:open sort:updated-desc",
        ]);
    });

    it("skips Codeberg when the viewer has no Codeberg account", async () => {
        const dashboard = await callerFor({ user: { id: "user-1" } }, [
            "github",
        ]);

        const result = await dashboard.recentPulls({});

        expect(getCodebergTokenMock).not.toHaveBeenCalled();
        expect(searchIssuesAcrossReposMock).not.toHaveBeenCalled();
        expect(result.items.map((item) => item.provider)).toEqual(["gh"]);
    });

    it("skips GitHub when the viewer has no GitHub account", async () => {
        const dashboard = await callerFor({ user: { id: "user-1" } }, []);

        const result = await dashboard.recentPulls({});

        // The token getter would hand back the deployment's shared browsing
        // token, whose authored pulls are not the viewer's.
        expect(envState.sharedToken).toBeDefined();
        expect(getGitHubTokenMock).not.toHaveBeenCalled();
        expect(result).toEqual({ items: [], unavailable: [] });
    });

    it("keeps the other provider's items when one fails", async () => {
        searchIssuesAcrossReposMock.mockRejectedValue(
            new Error("codeberg down"),
        );
        const dashboard = await callerFor(bothLinked);

        const result = await dashboard.recentPulls({});

        expect(result.unavailable).toEqual(["cb"]);
        expect(result.items.map((item) => item.provider)).toEqual(["gh"]);
    });

    it("returns the viewer's issues merged across providers", async () => {
        searchIssuesAcrossReposMock.mockResolvedValue([
            { ...CB_PULL, pull_request: null },
        ]);
        const dashboard = await callerFor(bothLinked);

        const result = await dashboard.recentIssues({ provider: "all" });

        expect(result.items).toEqual([
            expect.objectContaining({
                provider: "cb",
                repo: "acme/site",
                number: 7,
            }),
            expect.objectContaining({
                provider: "gh",
                repo: "acme/api",
                number: 4,
                comments: 0,
            }),
        ]);
    });

    it("lists nothing for visitors without a session", async () => {
        const dashboard = await callerFor(null);

        await expect(dashboard.recentIssues({})).resolves.toEqual({
            items: [],
            unavailable: [],
        });
        expect(graphqlMock).not.toHaveBeenCalled();
    });
});
