// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let paramsState = new URLSearchParams("state=open&page=2");

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => paramsState,
}));

import { type SearchArgs, useSearchList } from "./use-search-list";

const pageResult = {
    items: [],
    totalCount: 60,
    hasNextPage: true,
    endCursor: "cursor-alpha",
    stateCounts: {},
};

function makeConfig(owner: string) {
    return {
        provider: "gh" as const,
        baseRoute: `/gh/${owner}/repo/pulls`,
        owner,
        repo: "repo",
        defaultState: "open",
        qualifiers: ["author"],
        autocompleteOptions: {},
        stateQualifierFn: (tab: string) => `is:${tab}`,
    };
}

function setup() {
    const searchFetch = vi.fn(async (_args: SearchArgs) => pageResult);
    const useSearchQuery = vi.fn(
        (_args: SearchArgs, _opts?: { enabled?: boolean }) => ({
            data: pageResult,
            isLoading: false,
        }),
    );
    return { searchFetch, useSearchQuery };
}

describe("useSearchList page cursors", () => {
    it("resolves the previous page cursor before querying page 2", async () => {
        paramsState = new URLSearchParams("state=open&page=2");
        const { searchFetch, useSearchQuery } = setup();

        renderHook(() =>
            useSearchList(makeConfig("alpha"), { useSearchQuery, searchFetch }),
        );

        await waitFor(() => {
            expect(useSearchQuery.mock.calls.at(-1)?.[0]).toMatchObject({
                owner: "alpha",
                page: 2,
                after: "cursor-alpha",
            });
        });
    });

    it("drops the cached cursor when the repository changes", async () => {
        paramsState = new URLSearchParams("state=open&page=2");
        const { searchFetch, useSearchQuery } = setup();

        const { rerender } = renderHook(
            ({ owner }: { owner: string }) =>
                useSearchList(makeConfig(owner), {
                    useSearchQuery,
                    searchFetch,
                }),
            { initialProps: { owner: "alpha" } },
        );

        await waitFor(() => {
            expect(useSearchQuery.mock.calls.at(-1)?.[0]).toMatchObject({
                owner: "alpha",
                after: "cursor-alpha",
            });
        });

        rerender({ owner: "beta" });

        // The alpha cursor belongs to another repository, so page 2 must not
        // send it while the beta cursors are unresolved.
        expect(useSearchQuery.mock.calls.at(-1)?.[0]).toMatchObject({
            owner: "beta",
        });
        expect(useSearchQuery.mock.calls.at(-1)?.[0].after).toBeUndefined();
    });
});
