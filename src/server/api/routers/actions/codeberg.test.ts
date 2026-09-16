import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the db module so importing the Codeberg client does not require env.
vi.mock("~/server/db", () => ({ db: {} }));

import { CodebergActionsProvider } from "./codeberg";
import { FORGEJO_RUN_STATUS_VALUES } from "./types";

const provider = new CodebergActionsProvider("tok", "own", "repo");

function run(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        title: "Fix the thing",
        workflow_id: "ci.yml",
        index_in_repo: 42,
        prettyref: "main",
        commit_sha: "abc",
        event: "push",
        status: "success",
        trigger_user: {
            login: "bob",
            avatar_url: "https://example.com/bob.png",
        },
        created: "2026-09-13T13:34:06+02:00",
        started: "2026-09-13T13:34:17+02:00",
        updated: "2026-09-13T13:35:49+02:00",
        html_url: "https://codeberg.org/own/repo/actions/runs/42",
        ...overrides,
    };
}

function stubFetch(body: unknown) {
    const mock = vi.fn(async (_url: string | URL, _init?: RequestInit) => ({
        ok: true,
        json: async () => body,
    }));
    vi.stubGlobal("fetch", mock);
    return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("CodebergActionsProvider.listWorkflowRuns", () => {
    it("translates the filters into Forgejo query parameters", async () => {
        const mock = stubFetch({ total_count: 100, workflow_runs: [run()] });

        const page = await provider.listWorkflowRuns({
            workflow: "ci.yml",
            branch: "main",
            event: "push",
            status: "failure",
            page: 2,
        });

        const url = new URL(String(mock.mock.calls[0]?.[0]));
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            page: "2",
            limit: "30",
            event: "push",
            status: "failure",
            workflow_id: "ci.yml",
            // Forgejo filters by full ref, not by branch name.
            ref: "refs/heads/main",
        });
        expect(page.totalCount).toBe(100);
        expect(page.hasNextPage).toBe(true);
    });

    it("maps a blocked pull request run onto the shared shape", async () => {
        stubFetch({
            total_count: 1,
            workflow_runs: [
                run({
                    prettyref: "#14341",
                    status: "blocked",
                    event: "pull_request",
                }),
            ],
        });

        const { items } = await provider.listWorkflowRuns({ page: 1 });

        expect(items).toEqual([
            {
                id: 1,
                name: "ci.yml",
                runNumber: 42,
                displayTitle: "Fix the thing",
                event: "pull_request",
                status: "queued",
                conclusion: "action_required",
                // A pull request ref is not a branch.
                branch: null,
                actor: {
                    login: "bob",
                    avatarUrl: "https://example.com/bob.png",
                },
                pullRequestNumber: 14341,
                createdAt: "2026-09-13T13:34:06+02:00",
                runStartedAt: "2026-09-13T13:34:17+02:00",
                updatedAt: "2026-09-13T13:35:49+02:00",
                htmlUrl: "https://codeberg.org/own/repo/actions/runs/42",
            },
        ]);
    });

    it("normalizes a queued run that has not started", async () => {
        stubFetch({
            total_count: 1,
            workflow_runs: [
                // Forgejo sends the zero time until a runner picks the run up.
                run({ status: "waiting", started: "0001-01-01T00:00:00Z" }),
            ],
        });

        const { items } = await provider.listWorkflowRuns({ page: 1 });

        expect(items).toMatchObject([
            { status: "queued", conclusion: null, runStartedAt: null },
        ]);
    });

    it("rejects a status Forgejo does not report", async () => {
        stubFetch({ total_count: 0, workflow_runs: [] });

        await expect(
            provider.listWorkflowRuns({ status: "in_progress", page: 1 }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
});

describe("CodebergActionsProvider.listWorkflows", () => {
    it("lists the workflow files behind the most recent runs", async () => {
        stubFetch({
            total_count: 3,
            workflow_runs: [
                run({ workflow_id: "ci.yml" }),
                run({ workflow_id: "release.yml" }),
                run({ workflow_id: "ci.yml" }),
            ],
        });

        await expect(provider.listWorkflows()).resolves.toEqual([
            { id: "ci.yml", name: "ci.yml" },
            { id: "release.yml", name: "release.yml" },
        ]);
    });
});

describe("CodebergActionsProvider.listFilterOptions", () => {
    it("offers branches, events and Forgejo statuses, but no actors", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL) => ({
                ok: true,
                json: async () =>
                    String(input).includes("/branches")
                        ? [{ name: "main", commit: { id: "abc" } }]
                        : { total_count: 1, workflow_runs: [run()] },
                headers: { get: () => null },
            })),
        );

        await expect(provider.listFilterOptions()).resolves.toEqual({
            branches: ["main"],
            // Forgejo cannot filter runs by actor, so the toolbar omits it.
            actors: [],
            events: ["push"],
            statuses: [...FORGEJO_RUN_STATUS_VALUES],
        });
    });
});
