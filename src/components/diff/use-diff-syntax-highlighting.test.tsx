// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiffSyntaxHighlighting } from "./use-diff-syntax-highlighting";

const { mockHighlight } = vi.hoisted(() => ({
    mockHighlight: vi.fn((text: string) => ({ value: `<mark>${text}</mark>` })),
}));

vi.mock("highlight.js", () => ({
    default: {
        highlight: mockHighlight,
        getLanguage: () => true,
    },
}));

function Harness({
    rerenderKey,
    lines,
}: {
    rerenderKey: string;
    lines: string[];
}) {
    const ref = useRef<HTMLDivElement>(null);
    useDiffSyntaxHighlighting({
        diffRef: ref,
        language: "typescript",
        enabled: true,
        rerenderKey,
    });
    return (
        <div ref={ref}>
            {lines.map((text) => (
                <span key={text} className="d2h-code-line-ctn">
                    {text}
                </span>
            ))}
        </div>
    );
}

const highlighted = () =>
    Array.from(
        document.querySelectorAll(".d2h-code-line-ctn[data-diff-highlighted]"),
    );

describe("useDiffSyntaxHighlighting", () => {
    beforeEach(() => {
        mockHighlight.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("defers the pass and finishes every line in chunks", async () => {
        // Each performance.now() call advances past the chunk budget, so the
        // pass can only process one line per scheduled slice and must
        // reschedule until it is done.
        let now = 0;
        vi.spyOn(performance, "now").mockImplementation(() => {
            now += 10;
            return now;
        });
        const lines = ["one", "two", "three", "four"];

        render(<Harness rerenderKey="a" lines={lines} />);

        // The pass is scheduled across frames, not run synchronously.
        expect(highlighted()).toHaveLength(0);
        expect(mockHighlight).not.toHaveBeenCalled();

        await vi.waitFor(() => {
            expect(highlighted()).toHaveLength(lines.length);
        });
        expect(mockHighlight).toHaveBeenCalledTimes(lines.length);
    });

    it("re-highlights only newly rendered lines when the key changes", async () => {
        const { rerender } = render(
            <Harness rerenderKey="a" lines={["one", "two"]} />,
        );
        await vi.waitFor(() => expect(highlighted()).toHaveLength(2));
        mockHighlight.mockClear();

        rerender(<Harness rerenderKey="b" lines={["one", "two", "three"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(3));

        // Existing lines keep their highlight and are not re-processed; only
        // the newly rendered line gets a highlight call.
        expect(mockHighlight).toHaveBeenCalledTimes(1);
        expect(mockHighlight).toHaveBeenCalledWith("three", expect.anything());
        const spans = document.querySelectorAll(".d2h-code-line-ctn");
        expect(spans[0]!.innerHTML).toBe("<mark>one</mark>");
        expect(spans[1]!.innerHTML).toBe("<mark>two</mark>");
        expect(spans[2]!.innerHTML).toBe("<mark>three</mark>");
    });

    it("marks empty lines so later passes skip them", async () => {
        render(<Harness rerenderKey="a" lines={["one", "", "two"]} />);
        await vi.waitFor(() => expect(highlighted()).toHaveLength(3));

        // Empty lines carry no highlight call but are still marked done.
        expect(mockHighlight).toHaveBeenCalledTimes(2);
        expect(highlighted()).toHaveLength(3);
    });
});
