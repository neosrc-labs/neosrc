// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewCommentReplyComposer } from "./review-comment-reply-composer";

vi.mock("./markdown/markdown-editor", () => ({
    MarkdownEditor: (props: {
        value: string;
        onChange: (value: string) => void;
        footerActions?: Array<{ label: string; onClick: () => void }>;
    }) => (
        <div>
            <textarea
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
            />
            {props.footerActions?.map((action) => (
                <button
                    type="button"
                    key={action.label}
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            ))}
        </div>
    ),
}));

describe("ReviewCommentReplyComposer", () => {
    it("guards whitespace submissions and submits non-empty drafts", () => {
        const onSubmit = vi.fn();
        const { rerender } = render(
            <ReviewCommentReplyComposer
                value="   "
                onChange={vi.fn()}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
                isPending={false}
                isError={false}
                owner="o"
                repo="r"
                placeholder="Write a reply..."
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Reply" }));
        expect(onSubmit).not.toHaveBeenCalled();
        rerender(
            <ReviewCommentReplyComposer
                value="reply"
                onChange={vi.fn()}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
                isPending={false}
                isError={false}
                owner="o"
                repo="r"
                placeholder="Write a reply..."
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Reply" }));
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("shows the existing error message", () => {
        render(
            <ReviewCommentReplyComposer
                value="reply"
                onChange={vi.fn()}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
                isPending
                isError
                owner="o"
                repo="r"
                placeholder="Write a reply..."
            />,
        );
        expect(
            screen.getByText("Failed to post reply. Please try again."),
        ).toBeInTheDocument();
    });
});
