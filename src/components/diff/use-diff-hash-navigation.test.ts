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
});
