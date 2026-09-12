// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MAX_RUN_LINES,
    useDiffSyntaxHighlighting,
} from "./use-diff-syntax-highlighting";

const { mockHighlightLines } = vi.hoisted(() => ({
    mockHighlightLines: vi.fn(async (text: string) => {
        if (text.includes("unsupported")) return null;
        return text
            .split("\n")
            .map((line) => `<span class="shiki-token">${line}</span>`);
    }),
}));

vi.mock("~/utils/highlight", () => ({
    highlightLines: mockHighlightLines,
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
        mockHighlightLines.mockClear();
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
        expect(mockHighlightLines).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(highlighted()).toHaveLength(4));

        // Consecutive lines are one run: a single call keeps multi-line
        // constructs (block comments, template literals) intact.
        expect(mockHighlightLines).toHaveBeenCalledTimes(1);
        expect(mockHighlightLines).toHaveBeenCalledWith(
            "one\ntwo\nthree\nfour",
            "typescript",
        );
        for (const [index, line] of lines.entries()) {
            expect(spans()[index]!.innerHTML).toBe(
                `<span class="shiki-token">${line}</span>`,
            );
        }
    });

    it("re-highlights a run when a line joins it", async () => {
        const { rerender } = render(<Harness lines={["one", "two"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(2));
        mockHighlightLines.mockClear();

        // Expanded context arrives without any prop change: the run grows and
        // is recomputed as a whole.
        rerender(<Harness lines={["one", "two", "three"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(3));

        expect(mockHighlightLines).toHaveBeenCalledTimes(1);
        expect(mockHighlightLines).toHaveBeenCalledWith(
            "one\ntwo\nthree",
            "typescript",
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

        expect(mockHighlightLines).toHaveBeenCalledTimes(2);
        expect(mockHighlightLines).toHaveBeenCalledWith(
            "one\ntwo",
            "typescript",
        );
        expect(mockHighlightLines).toHaveBeenCalledWith(
            "twenty\ntwentyOne",
            "typescript",
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

        expect(mockHighlightLines).toHaveBeenCalledTimes(2);
        expect(mockHighlightLines.mock.calls[0]![0]).toBe(
            lines.slice(0, MAX_RUN_LINES).join("\n"),
        );
        expect(mockHighlightLines.mock.calls[1]![0]).toBe(lines[MAX_RUN_LINES]);
    });

    it("leaves an unsupported language as plain text", async () => {
        render(<Harness lines={["unsupported"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(1));

        // The line is marked done but its text is untouched.
        expect(spans()[0]!.innerHTML).toBe("unsupported");
    });

    it("marks empty lines so later passes skip them", async () => {
        render(<Harness lines={[""]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(1));

        // Nothing to tokenize, but the line must not be revisited.
        expect(mockHighlightLines).not.toHaveBeenCalled();
        expect(highlighted()).toHaveLength(1);
    });
});
