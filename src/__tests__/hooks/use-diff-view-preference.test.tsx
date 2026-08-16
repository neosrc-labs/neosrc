// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installLocalStorage } from "~/__tests__/helpers/local-storage";
import { useDiffViewPreference } from "~/hooks/use-diff-view-preference";
import { getDiffViewKey } from "~/utils/diff-view";

function setUpStorage(owner: string, repo: string, mode: string): Storage {
    const storage = installLocalStorage();
    storage.setItem(getDiffViewKey(owner, repo), mode);
    return storage;
}

/** Renders the hook's current value; the callback fires on every render pass. */
function Probe({ onRender }: { onRender: (view: string) => void }) {
    const [view] = useDiffViewPreference("ownerA", "repoA");
    onRender(view);
    return null;
}

describe("useDiffViewPreference", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("renders unified on the first render even when split is stored", () => {
        setUpStorage("ownerA", "repoA", "split");
        const views: string[] = [];

        render(<Probe onRender={(view) => views.push(view)} />);

        // Hydration-safe: the first render pass is "unified" on both server
        // and client; the stored preference arrives via the load effect.
        expect(views[0]).toBe("unified");
        expect(views.at(-1)).toBe("split");
    });

    it("does not write the initial value over the stored preference", () => {
        const storage = setUpStorage("ownerA", "repoA", "split");

        const { result } = renderHook(() =>
            useDiffViewPreference("ownerA", "repoA"),
        );
        act(() => {});

        // Loading the preference must not clobber it with "unified".
        expect(storage.getItem(getDiffViewKey("ownerA", "repoA"))).toBe(
            "split",
        );
        expect(result.current[0]).toBe("split");
    });

    it("persists explicit setter changes to the current repo", () => {
        const storage = setUpStorage("ownerA", "repoA", "unified");

        const { result } = renderHook(() =>
            useDiffViewPreference("ownerA", "repoA"),
        );
        act(() => {});

        act(() => {
            result.current[1]("split");
        });

        expect(result.current[0]).toBe("split");
        expect(storage.getItem(getDiffViewKey("ownerA", "repoA"))).toBe(
            "split",
        );
    });

    it("loads the new repo's preference on owner/repo change without writing the old mode", () => {
        const storage = setUpStorage("ownerA", "repoA", "split");
        storage.setItem(getDiffViewKey("ownerB", "repoB"), "unified");

        const { result, rerender } = renderHook(
            ({ owner, repo }: { owner: string; repo: string }) =>
                useDiffViewPreference(owner, repo),
            { initialProps: { owner: "ownerA", repo: "repoA" } },
        );
        act(() => {});
        expect(result.current[0]).toBe("split");

        rerender({ owner: "ownerB", repo: "repoB" });
        act(() => {});

        // Repo B's stored "unified" wins; repo A's "split" was not written
        // into repo B's key before the preference loaded.
        expect(result.current[0]).toBe("unified");
        expect(storage.getItem(getDiffViewKey("ownerB", "repoB"))).toBe(
            "unified",
        );
    });

    it("reloads the previous repo's preference when navigating back", () => {
        const storage = setUpStorage("ownerA", "repoA", "unified");
        storage.setItem(getDiffViewKey("ownerB", "repoB"), "split");

        const { result, rerender } = renderHook(
            ({ owner, repo }: { owner: string; repo: string }) =>
                useDiffViewPreference(owner, repo),
            { initialProps: { owner: "ownerA", repo: "repoA" } },
        );
        act(() => {});

        rerender({ owner: "ownerB", repo: "repoB" });
        act(() => {});
        expect(result.current[0]).toBe("split");

        rerender({ owner: "ownerA", repo: "repoA" });
        act(() => {});
        expect(result.current[0]).toBe("unified");
    });
});
