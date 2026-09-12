// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MAX_RUN_LINES,
    useDiffSyntaxHighlighting,
} from "./use-diff-syntax-highlighting";

const { mockHighlight } = vi.hoisted(() => ({
    // Wraps the whole input in one span (like a block comment), so the split
    // path is exercised.
    mockHighlight: vi.fn((text: string) => ({
        value: `<span class="hljs-comment">${text}</span>`,
    })),
}));

vi.mock("highlight.js", () => ({
    default: {
        highlight: mockHighlight,
        getLanguage: () => true,
    },
}));

function Harness({ lines, numbers }: { lines: string[]; numbers?: number[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useDiffSyntaxHighlighting({
        diffRef: ref,
        language: "typescript",
        enabled: true,
    });
    return (
        <div ref={ref}>
            {lines.map((text, index) => (
                <div key={numbers?.[index] ?? index}>
                    <span
                        className="d2h-code-line-ctn"
                        data-line-side="RIGHT"
                        data-line-number={numbers?.[index] ?? index + 1}
                    >
                        {text}
                    </span>
                </div>
            ))}
        </div>
    );
}

const spans = () =>
    Array.from(document.querySelectorAll<HTMLElement>(".d2h-code-line-ctn"));

const highlighted = () =>
    spans().filter((span) => span.hasAttribute("data-diff-highlighted"));

describe("useDiffSyntaxHighlighting", () => {
    beforeEach(() => {
        mockHighlight.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("defers the pass and highlights a run in one call", async () => {
        const lines = ["one", "two", "three", "four"];
        render(<Harness lines={lines} />);

        // The pass is scheduled across frames, not run synchronously.
        expect(highlighted()).toHaveLength(0);
        expect(mockHighlight).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(highlighted()).toHaveLength(4));

        // Consecutive lines are one run: a single call keeps multi-line
        // constructs (block comments) intact.
        expect(mockHighlight).toHaveBeenCalledTimes(1);
        expect(mockHighlight).toHaveBeenCalledWith(
            "one\ntwo\nthree\nfour",
            expect.anything(),
        );
        // The span covering the run is closed and reopened per line.
        for (const [index, line] of lines.entries()) {
            expect(spans()[index]!.innerHTML).toBe(
                `<span class="hljs-comment">${line}</span>`,
            );
        }
    });

    it("re-highlights a run when a line joins it", async () => {
        const { rerender } = render(<Harness lines={["one", "two"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(2));
        mockHighlight.mockClear();

        // Expanded context arrives without any prop change: the run grows and
        // is recomputed as a whole.
        rerender(<Harness lines={["one", "two", "three"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(3));

        expect(mockHighlight).toHaveBeenCalledTimes(1);
        expect(mockHighlight).toHaveBeenCalledWith(
            "one\ntwo\nthree",
            expect.anything(),
        );
    });

    it("chunks the work across runs", async () => {
        // Every performance.now() call advances past the chunk budget, so a
        // slice can only handle one run and must reschedule.
        let now = 0;
        vi.spyOn(performance, "now").mockImplementation(() => {
            now += 10;
            return now;
        });

        // Lines 1-2 and 20-21 are not adjacent, so they are two runs.
        render(
            <Harness
                lines={["one", "two", "twenty", "twentyOne"]}
                numbers={[1, 2, 20, 21]}
            />,
        );

        await vi.waitFor(() => expect(highlighted()).toHaveLength(4));

        expect(mockHighlight).toHaveBeenCalledTimes(2);
        expect(mockHighlight).toHaveBeenCalledWith(
            "one\ntwo",
            expect.anything(),
        );
        expect(mockHighlight).toHaveBeenCalledWith(
            "twenty\ntwentyOne",
            expect.anything(),
        );
    });

    it("splits a long run so one slice stays bounded", async () => {
        const lines = Array.from(
            { length: MAX_RUN_LINES + 1 },
            (_, index) => `line${index}`,
        );
        render(<Harness lines={lines} />);

        await vi.waitFor(() =>
            expect(highlighted()).toHaveLength(lines.length),
        );

        expect(mockHighlight).toHaveBeenCalledTimes(2);
        expect(mockHighlight.mock.calls[0]![0]).toBe(
            lines.slice(0, MAX_RUN_LINES).join("\n"),
        );
        expect(mockHighlight.mock.calls[1]![0]).toBe(lines[MAX_RUN_LINES]);
    });

    it("marks empty lines so later passes skip them", async () => {
        render(<Harness lines={[""]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(1));

        // Nothing to highlight, but the line must not be revisited.
        expect(mockHighlight).not.toHaveBeenCalled();
        expect(highlighted()).toHaveLength(1);
    });
});
