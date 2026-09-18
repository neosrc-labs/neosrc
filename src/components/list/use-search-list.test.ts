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

describe("useSearchList cached results", () => {
    const cached = {
        ...pageResult,
        items: ["cached pull"],
        endCursor: null,
    };
    const fresh = { ...cached, items: ["fresh pull"] };

    function renderSearch(initial: {
        data?: typeof cached;
        cachedData?: typeof cached | null;
        isLoading: boolean;
        isFetching?: boolean;
        isError?: boolean;
        isPaused?: boolean;
    }) {
        paramsState = new URLSearchParams();
        const searchFetch = vi.fn(async () => fresh);
        return renderHook(
            (state: typeof initial) =>
                useSearchList(makeConfig("alpha"), {
                    useSearchQuery: () => state,
                    searchFetch,
                }),
            { initialProps: initial },
        );
    }

    it("shows cached rows during refresh and replaces them with live rows", () => {
        const { result, rerender } = renderSearch({
            cachedData: cached,
            isLoading: true,
            isFetching: true,
        });
        expect(result.current.data?.items).toEqual(["cached pull"]);
        expect(result.current.showLoading).toBe(false);
        expect(result.current.refreshStatus).toBe("refreshing");

        rerender({ data: fresh, cachedData: cached, isLoading: false });
        expect(result.current.data?.items).toEqual(["fresh pull"]);
        expect(result.current.refreshStatus).toBeUndefined();
    });

    it("retains cached rows with an error after a failed refresh", () => {
        const { result, rerender } = renderSearch({
            cachedData: cached,
            isLoading: true,
            isFetching: true,
        });
        rerender({ cachedData: cached, isLoading: false, isError: true });
        expect(result.current.data?.items).toEqual(["cached pull"]);
        expect(result.current.showLoading).toBe(false);
        expect(result.current.refreshStatus).toBe("error");
    });

    it("keeps a successful empty live response when cached rows arrive late", () => {
        const empty = { ...fresh, items: [], totalCount: 0 };
        const { result, rerender } = renderSearch({
            data: empty,
            isLoading: false,
        });
        rerender({ data: empty, cachedData: cached, isLoading: false });
        expect(result.current.data?.items).toEqual([]);
        expect(result.current.totalPages).toBe(0);
        expect(result.current.refreshStatus).toBeUndefined();
    });

    it("treats a cached empty result as usable while the live query is pending", () => {
        const { result } = renderSearch({
            cachedData: { ...cached, items: [], totalCount: 0 },
            isLoading: true,
            isFetching: true,
        });
        expect(result.current.data?.items).toEqual([]);
        expect(result.current.showLoading).toBe(false);
        expect(result.current.refreshStatus).toBe("refreshing");
    });

    it("keeps loading on a cache miss and marks offline cached rows as paused", () => {
        const { result, rerender } = renderSearch({
            cachedData: null,
            isLoading: true,
            isFetching: true,
        });
        expect(result.current.showLoading).toBe(true);
        rerender({ cachedData: cached, isLoading: false, isPaused: true });
        expect(result.current.data?.items).toEqual(["cached pull"]);
        expect(result.current.showLoading).toBe(false);
        expect(result.current.refreshStatus).toBe("paused");
    });
});
