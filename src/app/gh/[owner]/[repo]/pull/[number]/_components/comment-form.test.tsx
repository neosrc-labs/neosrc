// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockMarkdownEditor } from "~/__tests__/helpers/component-mocks";

import { CommentForm } from "./comment-form";

const mocks = vi.hoisted(() => ({
    closeMutate: vi.fn(),
    addCommentMutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
    }),
}));

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => ({
            timeline: {
                list: {
                    cancel: vi.fn(),
                    getInfiniteData: vi.fn(),
                    setInfiniteData: vi.fn(),
                    invalidate: vi.fn(),
                },
            },
            reviews: {
                getPending: { invalidate: vi.fn() },
            },
        }),
        users: {
            currentUser: {
                useQuery: () => ({ data: undefined }),
            },
        },
        pulls: {
            addComment: {
                useMutation: () => ({
                    mutate: mocks.addCommentMutate,
                    isPending: false,
                    isError: false,
                }),
            },
            close: {
                useMutation: () => ({
                    mutate: mocks.closeMutate,
                    isPending: false,
                    isError: false,
                }),
            },
        },
    },
}));

vi.mock("~/components/markdown/markdown-editor", () => mockMarkdownEditor());

vi.mock("~/hooks/use-autosave", () => ({
    readAutosave: () => "",
    useAutosave: () => ({ clear: vi.fn() }),
}));

function renderForm(canClose: boolean) {
    render(
        <CommentForm
            owner="owner"
            repo="repo"
            number={1}
            canClose={canClose}
        />,
    );
}

describe("CommentForm close button", () => {
    it("hides the close button when the user cannot close the PR", () => {
        renderForm(false);

        expect(
            screen.queryByRole("button", { name: "Close pull request" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Close with comment" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Comment" }),
        ).toBeInTheDocument();
    });

    it("renders Close pull request left of Comment when the box is empty", () => {
        renderForm(true);

        const close = screen.getByRole("button", {
            name: "Close pull request",
        });
        const comment = screen.getByRole("button", { name: "Comment" });

        expect(close).toBeInTheDocument();
        expect(
            close.compareDocumentPosition(comment) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("switches to Close with comment once the user types", async () => {
        renderForm(true);

        await userEvent.type(screen.getByTestId("editor-textarea"), "hello");

        expect(
            screen.getByRole("button", { name: "Close with comment" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Close pull request" }),
        ).not.toBeInTheDocument();
    });

    it("closes without a comment body when empty", async () => {
        renderForm(true);

        await userEvent.click(
            screen.getByRole("button", { name: "Close pull request" }),
        );

        expect(mocks.closeMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
        });
    });

    it("closes with the comment body when typed", async () => {
        renderForm(true);

        await userEvent.type(screen.getByTestId("editor-textarea"), "hello");
        await userEvent.click(
            screen.getByRole("button", { name: "Close with comment" }),
        );

        expect(mocks.closeMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
            body: "hello",
        });
    });
});
