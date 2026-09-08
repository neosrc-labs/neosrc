// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffRenderItem, GapRange } from "./types";
import { useDiffHashNavigation } from "./use-diff-hash-navigation";

function blockStub(): DiffRenderItem {
    return {
        type: "block",
        block: { oldStartLine: 1, newStartLine: 1, header: "", lines: [] },
    };
}

function gap(startLine: number, endLine: number): DiffRenderItem {
    return { type: "gap", startLine, endLine, oldStartLine: startLine };
}

function renderItemsFor(): DiffRenderItem[] {
    // One leading gap (1-9), one middle gap (11-50), one trailing gap.
    return [gap(1, 9), blockStub(), gap(11, 50), blockStub(), gap(60, -1)];
}

function createStateSink(initial?: Array<[string, GapRange[]]>) {
    let state = new Map<string, GapRange[]>(initial ?? []);
    const setExpandedGaps = vi.fn(
        (
            updater:
                | Map<string, GapRange[]>
                | ((prev: Map<string, GapRange[]>) => Map<string, GapRange[]>),
        ) => {
            state = typeof updater === "function" ? updater(state) : updater;
        },
    );
    return { getState: () => state, setExpandedGaps };
}

let unmountHook: (() => void) | null = null;

function mountHash(
    hash: string,
    initial?: Array<[string, GapRange[]]>,
): ReturnType<typeof createStateSink> {
    window.location.hash = hash;
    const renderItemsRef = { current: renderItemsFor() };
    const sink = createStateSink(initial);
    const result = renderHook(() =>
        useDiffHashNavigation({
            parsed: true,
            fileHash: "abc123",
            renderItemsRef,
            setExpandedGaps: sink.setExpandedGaps,
            setSelectedRange: vi.fn(),
        }),
    );
    unmountHook = result.unmount;
    // A few rAF frames: the poll calls expandTargetGap while the target
    // element is absent from the DOM.
    act(() => {
        vi.advanceTimersByTime(100);
    });
    return sink;
}

describe("useDiffHashNavigation", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        unmountHook?.();
        unmountHook = null;
        window.location.hash = "";
        document.body.innerHTML = "";
        vi.useRealTimers();
    });

    it("reveals a window around a leading-gap target", () => {
        // Leading gap 1-9, target line 6: four lines of context each side,
        // clamped to the gap.
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R6");
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-1")).toEqual([{ start: 2, end: 9 }]);
    });

    it("reveals a window around a middle-gap target", () => {
        // Middle gap 11-50, target line 25.
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R25");
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-11")).toEqual([{ start: 21, end: 29 }]);
    });

    it("merges with existing reveals instead of replacing them", () => {
        const { getState } = mountHash("#diff-abc123R25", [
            ["gap-11", [{ start: 11, end: 14 }]],
        ]);
        expect(getState().get("gap-11")).toEqual([
            { start: 11, end: 14 },
            { start: 21, end: 29 },
        ]);
    });

    it("leaves a gap untouched when it already covers the target", () => {
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R25", [
            ["gap-11", [{ start: 11, end: 50 }]],
        ]);
        expect(setExpandedGaps).toHaveBeenCalled();
        // The reveal is already covered, so no new state is committed.
        expect(getState().get("gap-11")).toEqual([{ start: 11, end: 50 }]);
    });

    it("expands every gap containing either end of a range", () => {
        // Start line 5 lies in the leading gap (1-9), end line 45 in the
        // middle gap (11-50): both must be revealed for the range to be
        // reachable, not just the first matching gap.
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R5-R45");
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-1")).toEqual([{ start: 1, end: 9 }]);
        expect(getState().get("gap-11")).toEqual([{ start: 41, end: 49 }]);
    });

    it("does not expand anything for an unrelated hash", () => {
        const { getState, setExpandedGaps } = mountHash("#other-section");
        expect(setExpandedGaps).not.toHaveBeenCalled();
        expect(getState().size).toBe(0);
    });

    describe("user scroll cancels re-centering", () => {
        function mountWithTarget(): ReturnType<typeof vi.fn> {
            const target = document.createElement("div");
            target.id = "diff-abc123R6";
            document.body.appendChild(target);
            const scrollTo = vi.fn();
            window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
            mountHash("#diff-abc123R6");
            // The poll waits for the target's position to settle, then scrolls.
            expect(scrollTo).toHaveBeenCalledTimes(1);
            return scrollTo;
        }

        it("keeps correcting for layout shift while the user is idle", () => {
            const scrollTo = mountWithTarget();

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(scrollTo.mock.calls.length).toBeGreaterThan(1);
        });

        it("stops correcting once the user scrolls", () => {
            const scrollTo = mountWithTarget();

            act(() => {
                window.dispatchEvent(new WheelEvent("wheel"));
            });
            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);
        });

        it("ignores typing in an editor and keeps correcting", () => {
            const textarea = document.createElement("textarea");
            document.body.appendChild(textarea);
            const scrollTo = mountWithTarget();

            act(() => {
                textarea.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: " ",
                        bubbles: true,
                    }),
                );
            });
            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(scrollTo.mock.calls.length).toBeGreaterThan(1);
        });

        it("stops correcting on a scroll key pressed outside an editor", () => {
            const scrollTo = mountWithTarget();

            act(() => {
                window.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "PageDown" }),
                );
            });
            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(scrollTo).toHaveBeenCalledTimes(1);
        });
    });
});
