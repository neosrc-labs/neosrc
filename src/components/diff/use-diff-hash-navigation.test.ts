// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffRenderItem, GapExpansion } from "./types";
import { useDiffHashNavigation } from "./use-diff-hash-navigation";

function blockStub(): DiffRenderItem {
    return {
        type: "block",
        block: { oldStartLine: 1, newStartLine: 1, header: "", lines: [] },
    };
}

function gap(startLine: number, endLine: number): DiffRenderItem {
    return { type: "gap", startLine, endLine };
}

function renderItemsFor(): DiffRenderItem[] {
    // One leading gap (1-9), one middle gap (11-50), one trailing gap.
    return [gap(1, 9), blockStub(), gap(11, 50), blockStub(), gap(60, -1)];
}

function createStateSink(initial?: Map<string, GapExpansion>) {
    let state = initial ?? new Map<string, GapExpansion>();
    const setExpandedGaps = vi.fn(
        (
            updater:
                | Map<string, GapExpansion>
                | ((
                      prev: Map<string, GapExpansion>,
                  ) => Map<string, GapExpansion>),
        ) => {
            state = typeof updater === "function" ? updater(state) : updater;
        },
    );
    return { getState: () => state, setExpandedGaps };
}

let unmountHook: (() => void) | null = null;

function mountHash(
    hash: string,
    initial?: Map<string, GapExpansion>,
): ReturnType<typeof createStateSink> {
    window.location.hash = hash;
    const renderItemsRef = { current: renderItemsFor() };
    const sink = createStateSink(initial);
    const result = renderHook(() =>
        useDiffHashNavigation({
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

    it("reveals a leading-gap target from the gap end (bottom)", () => {
        // Leading gap 1-9, target line 6: needs the last 9-6+1 = 4 lines.
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R6");
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-1")).toEqual({ top: 0, bottom: 4 });
    });

    it("reveals a middle-gap target from the gap start (top)", () => {
        // Middle gap 11-50, target line 25: needs 25-11+1 = 15 lines.
        const { getState, setExpandedGaps } = mountHash("#diff-abc123R25");
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-11")).toEqual({ top: 15, bottom: 0 });
    });

    it("expands exactly enough to reach the last line of a gap", () => {
        // Target line 50 = the end of the middle gap: 50-11+1 = 40 lines.
        const { getState } = mountHash("#diff-abc123R50");
        expect(getState().get("gap-11")).toEqual({ top: 40, bottom: 0 });
    });

    it("merges with existing expansion instead of shrinking it", () => {
        const { getState } = mountHash(
            "#diff-abc123R25",
            new Map([["gap-11", { top: 5, bottom: 3 }]]),
        );
        // Bottom expansion (3) is preserved while top grows to the needed 15.
        expect(getState().get("gap-11")).toEqual({ top: 15, bottom: 3 });
    });

    it("leaves a gap untouched when it already covers the target", () => {
        const { getState } = mountHash(
            "#diff-abc123R25",
            new Map([["gap-11", { top: 20, bottom: 0 }]]),
        );
        // Same map instance: no change was committed.
        expect(getState().get("gap-11")).toEqual({ top: 20, bottom: 0 });
    });

    it("expands every gap containing either end of a range", () => {
        // Start line 5 lies in the leading gap (1-9), end line 45 in the
        // middle gap (11-50): both must be revealed for the range to be
        // reachable, not just the first matching gap.
        const { getState, setExpandedGaps } = mountHash(
            "#diff-abc123R5-R45",
        );
        expect(setExpandedGaps).toHaveBeenCalled();
        expect(getState().get("gap-1")).toEqual({ top: 0, bottom: 5 });
        expect(getState().get("gap-11")).toEqual({ top: 35, bottom: 0 });
    });

    it("does not expand anything for an unrelated hash", () => {
        const { getState, setExpandedGaps } = mountHash("#other-section");
        expect(setExpandedGaps).not.toHaveBeenCalled();
        expect(getState().size).toBe(0);
    });
});
