// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewCommentBase } from "~/server/github";
import { ReviewCommentItem } from "./review-comment-item";

vi.mock("~/components/comment-card", () => ({
    CommentCard: (props: {
        children: React.ReactNode;
        headerActions?: React.ReactNode;
        footer?: React.ReactNode;
        variant?: string;
    }) => (
        <article data-variant={props.variant}>
            {props.headerActions}
            {props.children}
            {props.footer}
        </article>
    ),
}));
vi.mock("~/components/markdown/markdown-renderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock("~/components/reaction-picker", () => ({
    ReactionPicker: () => <button type="button">Pick reaction</button>,
}));
vi.mock("~/components/reaction-bar", () => ({
    ReactionBar: () => <span>Reactions</span>,
}));
vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    PopoverContent: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));
vi.mock("~/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    DialogDescription: ({ children }: { children: React.ReactNode }) => (
        <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
        <h2>{children}</h2>
    ),
}));
vi.mock("lucide-react", () => ({
    MoreVertical: () => <span />,
    SquarePen: () => <span />,
    Trash2: () => <span />,
}));

const permissionContext = {
    currentUser: "alice",
    isPullRequestAuthor: false,
    isPullRequestLocked: false,
    repoPermission: "write" as const,
};

const comment = (id = 1) =>
    ({
        id,
        body: "comment body",
        path: "src/example.ts",
        line: 4,
        start_line: null,
        user: {
            login: "alice",
            html_url: "https://example.test/alice",
            avatar_url: "",
        },
        created_at: "2026-01-01T00:00:00Z",
        author_association: "CONTRIBUTOR",
    }) as unknown as ReviewCommentBase;

describe("ReviewCommentItem", () => {
    it("renders parent and reply placements with edit and task callbacks", () => {
        const onStartEdit = vi.fn();
        const onToggleTask = vi.fn();
        render(
            <ReviewCommentItem
                comment={comment()}
                placement="parent"
                threadId="thread-1"
                displayBody="saved body"
                reactions={[]}
                permissionContext={permissionContext}
                owner="o"
                repo="r"
                number={1}
                isPending={false}
                isOutdated={false}
                isStub={false}
                isEditing={false}
                editBody=""
                onStartEdit={onStartEdit}
                onEditBodyChange={vi.fn()}
                onCancelEdit={vi.fn()}
                onSaveEdit={vi.fn()}
                onReact={vi.fn()}
                onDelete={vi.fn()}
                onToggleTask={onToggleTask}
            />,
        );
        expect(screen.getByRole("article")).toHaveAttribute(
            "data-variant",
            "default",
        );
        expect(screen.getByText("saved body")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Edit comment" }));
        expect(onStartEdit).toHaveBeenCalledOnce();
    });

    it("confirms deletion and hides edit/delete controls for stubs", () => {
        const onDelete = vi.fn();
        const { rerender } = render(
            <ReviewCommentItem
                comment={comment()}
                placement="reply"
                threadId="thread-1"
                displayBody="body"
                reactions={[]}
                permissionContext={permissionContext}
                owner="o"
                repo="r"
                number={1}
                isPending={false}
                isOutdated={false}
                isStub={false}
                isEditing={false}
                editBody=""
                onStartEdit={vi.fn()}
                onEditBodyChange={vi.fn()}
                onCancelEdit={vi.fn()}
                onSaveEdit={vi.fn()}
                onReact={vi.fn()}
                onDelete={onDelete}
                onToggleTask={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "More options" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(onDelete).toHaveBeenCalledOnce();
        rerender(
            <ReviewCommentItem
                comment={comment(-1)}
                placement="reply"
                threadId="thread-1"
                displayBody="body"
                reactions={[]}
                permissionContext={permissionContext}
                owner="o"
                repo="r"
                number={1}
                isPending
                isOutdated={false}
                isStub
                isEditing={false}
                editBody=""
                onStartEdit={vi.fn()}
                onEditBodyChange={vi.fn()}
                onCancelEdit={vi.fn()}
                onSaveEdit={vi.fn()}
                onReact={vi.fn()}
                onDelete={onDelete}
                onToggleTask={vi.fn()}
            />,
        );
        expect(
            screen.queryByRole("button", { name: "Edit comment" }),
        ).toBeNull();
        expect(
            screen.queryByRole("button", { name: "More options" }),
        ).toBeNull();
        expect(screen.getByText("Saving...")).toBeInTheDocument();
    });
});
