import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "~/utils/provider-url";
import {
    browseDirectory,
    type DirectoryBrowseAdapter,
    type UndecoratedDirectoryEntry,
} from "./directory-browse";

const cacheKeys = vi.hoisted(() => [] as string[]);

vi.mock("~/server/cache", () => ({
    withStaleWhileRevalidate: async <T>(
        key: string,
        fetcher: () => Promise<T>,
    ): Promise<T> => {
        cacheKeys.push(key);
        return fetcher();
    },
}));

beforeEach(() => {
    cacheKeys.length = 0;
});

const FILE: UndecoratedDirectoryEntry = {
    kind: "file",
    name: "z.txt",
    path: "docs/z.txt",
    objectId: "file-object",
    size: 12,
};
const DIRECTORY: UndecoratedDirectoryEntry = {
    kind: "directory",
    name: "assets",
    path: "docs/assets",
    objectId: "directory-object",
    size: 0,
};

function adapterFor(provider: Provider): DirectoryBrowseAdapter {
    return {
        provider,
        resolveReference: vi.fn(async (_token, _repository, reference) => ({
            reference,
            objectId: "resolved-object",
        })),
        readPath: vi.fn(async () => ({
            outcome: "found" as const,
            classification: { kind: "directory" as const },
            entries: [FILE, DIRECTORY],
        })),
        readDecorations: vi.fn(async () => ({
            [FILE.path]: {
                objectId: "commit-object",
                message: "Update z.txt",
                committedAt: "2026-09-19T12:00:00Z",
            },
        })),
    };
}

const EXECUTION = { accessToken: "token", userId: "user" };
const REPOSITORY = { owner: "acme", repo: "project" };

describe.each(["gh", "cb"] as const)(
    "%s directory browse adapter contract",
    (provider) => {
        it("uses one resolved object for the path and every decoration", async () => {
            const adapter = adapterFor(provider);

            const result = await browseDirectory(adapter, EXECUTION, {
                provider,
                repository: REPOSITORY,
                reference: { kind: "tag", value: "v1.0.0" },
                path: "/docs//",
            });

            expect(adapter.resolveReference).toHaveBeenCalledOnce();
            expect(adapter.readPath).toHaveBeenCalledWith(
                "token",
                REPOSITORY,
                "resolved-object",
                "docs",
            );
            expect(adapter.readDecorations).toHaveBeenCalledWith(
                EXECUTION,
                REPOSITORY,
                "resolved-object",
                [FILE, DIRECTORY],
            );
            expect(result).toEqual({
                outcome: "found",
                reference: {
                    reference: { kind: "tag", value: "v1.0.0" },
                    objectId: "resolved-object",
                },
                path: "docs",
                classification: { kind: "directory" },
                entries: [
                    { ...DIRECTORY, commit: null },
                    {
                        ...FILE,
                        commit: {
                            objectId: "commit-object",
                            message: "Update z.txt",
                            committedAt: "2026-09-19T12:00:00Z",
                        },
                    },
                ],
            });
        });

        it("separates branch and tag cache entries with the same object", async () => {
            const adapter = adapterFor(provider);
            const baseInput = {
                provider,
                repository: REPOSITORY,
                path: "docs",
            } as const;

            await browseDirectory(adapter, EXECUTION, {
                ...baseInput,
                reference: { kind: "branch", value: "release" },
            });
            await browseDirectory(adapter, EXECUTION, {
                ...baseInput,
                reference: { kind: "tag", value: "release" },
            });

            expect(cacheKeys).toEqual([
                `directory-browse:v1:${provider}:user:acme:project:branch:release:resolved-object:docs`,
                `directory-browse:v1:${provider}:user:acme:project:tag:release:resolved-object:docs`,
            ]);
        });

        it("returns missing without attempting decorations", async () => {
            const adapter = adapterFor(provider);
            vi.mocked(adapter.readPath).mockResolvedValueOnce({
                outcome: "missing",
            });

            const result = await browseDirectory(adapter, EXECUTION, {
                provider,
                repository: REPOSITORY,
                reference: { kind: null, value: "main" },
                path: "absent",
            });

            expect(result.outcome).toBe("missing");
            expect(adapter.readDecorations).not.toHaveBeenCalled();
        });

        it("keeps the directory usable when decoration fails", async () => {
            const adapter = adapterFor(provider);
            vi.mocked(adapter.readDecorations).mockRejectedValueOnce(
                new Error("decoration unavailable"),
            );

            const result = await browseDirectory(adapter, EXECUTION, {
                provider,
                repository: REPOSITORY,
                reference: { kind: "commit", value: "abc123" },
                path: "docs",
            });

            expect(result.outcome).toBe("found");
            if (result.outcome !== "found") return;
            expect(result.entries).toEqual([
                { ...DIRECTORY, commit: null },
                { ...FILE, commit: null },
            ]);
        });
    },
);
