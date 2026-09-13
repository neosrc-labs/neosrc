// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockMarkdownEditor } from "~/__tests__/helpers/component-mocks";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { CommentForm } from "./comment-form";

const signedIn: PullRequestPermissionContext = {
    currentUser: "octocat",
    isPullRequestAuthor: false,
    isPullRequestLocked: false,
    repoPermission: "write",
};

const signedInLocked: PullRequestPermissionContext = {
    currentUser: "octocat",
    isPullRequestAuthor: false,
    isPullRequestLocked: true,
    repoPermission: "none",
};

const anonymous: PullRequestPermissionContext = {
    currentUser: null,
    isPullRequestAuthor: false,
    isPullRequestLocked: false,
    repoPermission: null,
};

const anonymousLocked: PullRequestPermissionContext = {
    ...anonymous,
    isPullRequestLocked: true,
};

const mocks = vi.hoisted(() => ({
    closeMutate: vi.fn(),
    reopenMutate: vi.fn(),
    addCommentMutate: vi.fn(),
    issueAddMutate: vi.fn(),
    issueCloseMutate: vi.fn(),
    issueReopenMutate: vi.fn(),
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
            issues: {
                timeline: {
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
            reopen: {
                useMutation: () => ({
                    mutate: mocks.reopenMutate,
                    isPending: false,
                    isError: false,
                }),
            },
        },
        issues: {
            addComment: {
                useMutation: () => ({
                    mutate: mocks.issueAddMutate,
                    isPending: false,
                    isError: false,
                }),
            },
            close: {
                useMutation: () => ({
                    mutate: mocks.issueCloseMutate,
                    isPending: false,
                    isError: false,
                }),
            },
            reopen: {
                useMutation: () => ({
                    mutate: mocks.issueReopenMutate,
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

function renderForm(canClose = false, canReopen = false, branchExists = true) {
    render(
        <CommentForm
            owner="owner"
            repo="repo"
            number={1}
            permissionContext={signedIn}
            canClose={canClose}
            canReopen={canReopen}
            branchExists={branchExists}
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

describe("CommentForm reopen button", () => {
    it("hides the reopen button when the PR is not closed", () => {
        renderForm(false, false);

        expect(
            screen.queryByRole("button", { name: "Reopen pull request" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Reopen and comment" }),
        ).not.toBeInTheDocument();
    });

    it("renders Reopen pull request left of Comment when the box is empty", () => {
        renderForm(false, true);

        const reopen = screen.getByRole("button", {
            name: "Reopen pull request",
        });
        const comment = screen.getByRole("button", { name: "Comment" });

        expect(reopen).toBeInTheDocument();
        expect(
            reopen.compareDocumentPosition(comment) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("switches to Reopen and comment once the user types", async () => {
        renderForm(false, true);

        await userEvent.type(screen.getByTestId("editor-textarea"), "hello");

        expect(
            screen.getByRole("button", { name: "Reopen and comment" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Reopen pull request" }),
        ).not.toBeInTheDocument();
    });

    it("reopens without a comment body when empty", async () => {
        renderForm(false, true);

        await userEvent.click(
            screen.getByRole("button", { name: "Reopen pull request" }),
        );

        expect(mocks.reopenMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
        });
    });

    it("reopens with the comment body when typed", async () => {
        renderForm(false, true);

        await userEvent.type(screen.getByTestId("editor-textarea"), "hello");
        await userEvent.click(
            screen.getByRole("button", { name: "Reopen and comment" }),
        );

        expect(mocks.reopenMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
            body: "hello",
        });
    });

    it("disables the reopen button when the head branch no longer exists", () => {
        renderForm(false, true, false);

        const reopen = screen.getByRole("button", {
            name: "Reopen pull request",
        });

        expect(reopen).toBeDisabled();
        expect(reopen).toHaveAttribute("title", "The head branch was deleted.");
    });
});

describe("CommentForm issue kind", () => {
    it("posts comments with issueNumber", async () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                kind="issue"
                permissionContext={signedIn}
            />,
        );

        await userEvent.type(screen.getByTestId("editor-textarea"), "hello");
        await userEvent.click(screen.getByRole("button", { name: "Comment" }));

        expect(mocks.issueAddMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            issueNumber: 1,
            body: "hello",
        });
    });

    it("renders Close issue and closes with issueNumber", async () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                kind="issue"
                permissionContext={signedIn}
                canClose
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Close issue" }),
        );

        expect(mocks.issueCloseMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            issueNumber: 1,
        });
    });

    it("renders Reopen issue and reopens with issueNumber", async () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                kind="issue"
                permissionContext={signedIn}
                canReopen
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Reopen issue" }),
        );

        expect(mocks.issueReopenMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            issueNumber: 1,
        });
    });
});

describe("CommentForm viewer states", () => {
    it("prompts a signed-out visitor to sign in instead of claiming the subject is locked", () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                kind="issue"
                permissionContext={anonymous}
            />,
        );

        expect(
            screen.getByText("Sign in to comment on this issue."),
        ).toBeInTheDocument();
        expect(screen.queryByText(/is locked/)).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/api/auth/signin",
        );
    });

    it("tells a signed-in viewer without access that the subject is locked", () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                permissionContext={signedInLocked}
            />,
        );

        expect(
            screen.getByText(
                "This pull request is locked. Only collaborators can comment.",
            ),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Comment" }),
        ).not.toBeInTheDocument();
    });

    it("still reports a locked subject to a signed-out visitor", () => {
        render(
            <CommentForm
                owner="owner"
                repo="repo"
                number={1}
                kind="issue"
                permissionContext={anonymousLocked}
            />,
        );

        expect(
            screen.getByText(
                "This issue is locked. Only collaborators can comment.",
            ),
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/api/auth/signin",
        );
    });
});
