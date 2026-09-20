// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiffCommentButton } from "./diff-comment-button";

function renderButton(
    activeComment: {
        type: "line";
        line: number;
        side: "LEFT" | "RIGHT";
    } | null = null,
) {
    const onStartComment = vi.fn();
    const onDragStart = vi.fn();
    const result = render(
        <DiffCommentButton
            line={5}
            side="RIGHT"
            rowLines={{ oldLine: 4, newLine: 5 }}
            isActive={activeComment?.line === 5}
            activeComment={activeComment}
            onStartComment={onStartComment}
            onDragStart={onDragStart}
            visibilityClass="block"
        />,
    );
    const button = result.container.querySelector("svg");
    if (!button) throw new Error("Comment button not found");
    return { button, onStartComment, onDragStart };
}

describe("DiffCommentButton", () => {
    it("starts or toggles a single-line comment", () => {
        const started = renderButton();
        fireEvent.click(started.button);
        expect(started.onStartComment).toHaveBeenCalledWith({
            type: "line",
            line: 5,
            side: "RIGHT",
        });

        const toggled = renderButton({ type: "line", line: 5, side: "RIGHT" });
        fireEvent.click(toggled.button);
        expect(toggled.onStartComment).toHaveBeenCalledWith(null);
    });

    it("extends an active comment on shift-click", () => {
        const { button, onStartComment } = renderButton({
            type: "line",
            line: 2,
            side: "RIGHT",
        });
        fireEvent.click(button, { shiftKey: true });
        expect(onStartComment).toHaveBeenCalledWith({
            type: "line",
            line: 5,
            side: "RIGHT",
            startLine: 2,
            startSide: "RIGHT",
        });
    });

    it("forwards drag selection with both row coordinates", () => {
        const { button, onDragStart } = renderButton();
        fireEvent.mouseDown(button);
        expect(onDragStart).toHaveBeenCalledWith(5, "RIGHT", {
            oldLine: 4,
            newLine: 5,
        });
    });
});
