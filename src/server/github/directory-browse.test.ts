import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCommit: vi.fn(),
    getRef: vi.fn(),
    getTag: vi.fn(),
    getRepoContents: vi.fn(),
    getFileLatestCommits: vi.fn(),
}));

vi.mock("./client", () => ({
    createOctokit: () => ({
        repos: { getCommit: mocks.getCommit },
        rest: {
            git: {
                getRef: mocks.getRef,
                getTag: mocks.getTag,
            },
        },
    }),
}));
vi.mock("./contents", () => ({ getRepoContents: mocks.getRepoContents }));
vi.mock("./tree", () => ({
    getFileLatestCommits: mocks.getFileLatestCommits,
}));

import { githubDirectoryBrowseAdapter } from "./directory-browse";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("githubDirectoryBrowseAdapter", () => {
    it("peels an annotated tag to one commit snapshot", async () => {
        mocks.getRef.mockResolvedValueOnce({
            data: { object: { type: "tag", sha: "tag-object" } },
        });
        mocks.getTag.mockResolvedValueOnce({
            data: { object: { type: "commit", sha: "commit-object" } },
        });

        const resolved = await githubDirectoryBrowseAdapter.resolveReference(
            "token",
            { owner: "acme", repo: "project" },
            { kind: "tag", value: "v1.0.0" },
        );

        expect(resolved).toEqual({
            reference: { kind: "tag", value: "v1.0.0" },
            objectId: "commit-object",
        });
        expect(mocks.getRef).toHaveBeenCalledWith({
            owner: "acme",
            repo: "project",
            ref: "tags/v1.0.0",
        });
        expect(mocks.getTag).toHaveBeenCalledWith({
            owner: "acme",
            repo: "project",
            tag_sha: "tag-object",
        });
    });

    it("pins provider-native resolution and decorates all paths at that object", async () => {
        mocks.getCommit.mockResolvedValueOnce({
            data: { sha: "resolved-object" },
        });
        mocks.getFileLatestCommits.mockResolvedValueOnce({
            "src/a.ts": {
                sha: "commit-a",
                message: "Update a.ts",
                committedDate: "2026-09-19T12:00:00Z",
            },
            "src/b.ts": null,
        });
        const repository = { owner: "acme", repo: "project" };
        const resolved = await githubDirectoryBrowseAdapter.resolveReference(
            "token",
            repository,
            { kind: null, value: "release" },
        );
        const entries = [
            {
                kind: "file" as const,
                name: "a.ts",
                path: "src/a.ts",
                objectId: "blob-a",
                size: 1,
            },
            {
                kind: "file" as const,
                name: "b.ts",
                path: "src/b.ts",
                objectId: "blob-b",
                size: 2,
            },
        ];

        const decorations = await githubDirectoryBrowseAdapter.readDecorations(
            { accessToken: "token", userId: "user" },
            repository,
            resolved.objectId,
            entries,
        );

        expect(resolved).toEqual({
            reference: { kind: "commit", value: "resolved-object" },
            objectId: "resolved-object",
        });
        expect(mocks.getFileLatestCommits).toHaveBeenCalledWith(
            "token",
            "user",
            "acme",
            "project",
            "resolved-object",
            ["src/a.ts", "src/b.ts"],
        );
        expect(decorations).toEqual({
            "src/a.ts": {
                objectId: "commit-a",
                message: "Update a.ts",
                committedAt: "2026-09-19T12:00:00Z",
            },
            "src/b.ts": null,
        });
    });
});
