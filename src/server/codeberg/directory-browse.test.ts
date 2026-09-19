import { afterEach, describe, expect, it, vi } from "vitest";
import type { UndecoratedDirectoryEntry } from "~/server/repository/directory-browse";
import { codebergDirectoryBrowseAdapter } from "./directory-browse";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("codebergDirectoryBrowseAdapter", () => {
    it("pins a provider-native reference to the resolved commit", async () => {
        const fetchMock = vi.fn(async (_input: string | URL | Request) =>
            Response.json([
                {
                    sha: "resolved-object",
                    commit: { message: "Resolve reference" },
                },
            ]),
        );
        vi.stubGlobal("fetch", fetchMock);

        const resolved = await codebergDirectoryBrowseAdapter.resolveReference(
            "token",
            { owner: "acme", repo: "project" },
            { kind: null, value: "release" },
        );

        expect(resolved).toEqual({
            reference: { kind: "commit", value: "resolved-object" },
            objectId: "resolved-object",
        });
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "/commits?sha=release&limit=1",
        );
    });

    it("attempts every decoration with bounded concurrency and isolates failures", async () => {
        let active = 0;
        let maximumActive = 0;
        const attempted: string[] = [];
        const gate = Promise.resolve();
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = new URL(String(input));
            const path = url.searchParams.get("path") ?? "";
            attempted.push(path);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await gate;
            active -= 1;

            if (path === "src/3.ts") {
                return new Response("unavailable", { status: 503 });
            }
            return Response.json([
                {
                    sha: `commit-${path}`,
                    commit: {
                        message: `Update ${path}\nBody`,
                        committer: { date: "2026-09-19T12:00:00Z" },
                    },
                },
            ]);
        });
        vi.stubGlobal("fetch", fetchMock);
        const entries: UndecoratedDirectoryEntry[] = Array.from(
            { length: 12 },
            (_, index) => ({
                kind: "file",
                name: `${index}.ts`,
                path: `src/${index}.ts`,
                objectId: `blob-${index}`,
                size: index,
            }),
        );

        const decorations =
            await codebergDirectoryBrowseAdapter.readDecorations(
                { accessToken: "token", userId: "user" },
                { owner: "acme", repo: "project" },
                "resolved-object",
                entries,
            );

        expect(attempted.sort()).toEqual(
            entries.map((entry) => entry.path).sort(),
        );
        expect(maximumActive).toBe(8);
        expect(decorations["src/3.ts"]).toBeNull();
        expect(decorations["src/4.ts"]).toEqual({
            objectId: "commit-src/4.ts",
            message: "Update src/4.ts",
            committedAt: "2026-09-19T12:00:00Z",
        });
    });
});
