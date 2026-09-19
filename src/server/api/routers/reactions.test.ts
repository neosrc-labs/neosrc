import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getGitHubToken: vi.fn(),
    getPullRequestReviewCommentReactions: vi.fn(),
}));

vi.mock("~/env", () => ({
    env: { GITHUB_ANONYMOUS_TOKEN: "shared-anonymous-token" },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
    getGitHubToken: mocks.getGitHubToken,
    isAnonymousToken: vi.fn(),
}));
vi.mock("~/server/codeberg", () => ({}));
vi.mock("~/server/github", () => ({
    getPullRequestReviewCommentReactions:
        mocks.getPullRequestReviewCommentReactions,
}));
vi.mock("~/server/github-graphql", () => ({}));

import { createCallerFactory } from "~/server/api/trpc";
import { reactionsRouter } from "./reactions";

const createCaller = createCallerFactory(reactionsRouter);
const context = {
    headers: new Headers(),
    db: {},
    session: null,
    isAnonymous: true,
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGitHubToken.mockResolvedValue("github-token");
});

describe("review comment reaction lookup", () => {
    it("deduplicates IDs and bounds upstream concurrency", async () => {
        let active = 0;
        let maximumActive = 0;
        mocks.getPullRequestReviewCommentReactions.mockImplementation(
            async (_token, _owner, _repo, commentId) => {
                active++;
                maximumActive = Math.max(maximumActive, active);
                await new Promise((resolve) => setTimeout(resolve, 5));
                active--;
                return [{ id: commentId }];
            },
        );
        const caller = createCaller(context as never);
        const commentIds = [
            1,
            1,
            ...Array.from({ length: 19 }, (_, i) => i + 2),
        ];

        const result = await caller.getForReviewComments({
            owner: "neosrc-labs",
            repo: "neosrc",
            commentIds,
        });

        expect(
            mocks.getPullRequestReviewCommentReactions,
        ).toHaveBeenCalledTimes(20);
        expect(maximumActive).toBeLessThanOrEqual(8);
        expect(Object.keys(result)).toHaveLength(20);
    });

    it("rejects more than 100 comment IDs", async () => {
        const caller = createCaller(context as never);

        await expect(
            caller.getForReviewComments({
                owner: "neosrc-labs",
                repo: "neosrc",
                commentIds: Array.from({ length: 101 }, (_, i) => i + 1),
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(mocks.getGitHubToken).not.toHaveBeenCalled();
    });
});
