import type { ReactNode } from "react";
import { vi } from "vitest";

/**
 * Factory for the MarkdownEditor module mock. Shared by component tests that
 * render MarkdownEditor (diff-view, file-diff, inline-comment-thread).
 *
 * The mock renders a container with `data-testid="markdown-editor"`, a
 * textarea, a Cancel button, and one button per footer action. testids for the
 * textarea and cancel button are configurable because some tests interact with
 * them.
 */
export function mockMarkdownEditor(options?: {
    textareaTestId?: string;
    cancelTestId?: string;
}) {
    return {
        MarkdownEditor: (props: {
            value?: string;
            onChange?: (value: string) => void;
            onCancel?: () => void;
            footerActions?: Array<{
                label: string;
                onClick: (text: string) => void;
                disabled?: (text: string) => boolean;
            }>;
        }) => (
            <div data-testid="markdown-editor">
                <textarea
                    data-testid={options?.textareaTestId ?? "editor-textarea"}
                    onChange={(e) => props.onChange?.(e.target.value)}
                    value={props.value ?? ""}
                />
                <button
                    data-testid={options?.cancelTestId ?? "editor-cancel"}
                    onClick={() => props.onCancel?.()}
                    type="button"
                >
                    Cancel
                </button>
                {(props.footerActions ?? []).map((action) => (
                    <button
                        key={action.label}
                        data-testid={`action-${action.label}`}
                        onClick={() => action.onClick(props.value ?? "")}
                        type="button"
                        disabled={action.disabled?.(props.value ?? "") ?? false}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        ),
    };
}

/** Factory for the CommentCard module mock (comment threads/reviews). */
export function mockCommentCard() {
    return {
        CommentCard: ({
            children,
            headerActions,
            footer,
            userHref,
        }: {
            children?: ReactNode;
            headerActions?: ReactNode;
            footer?: ReactNode;
            userHref?: string;
        }) => (
            <div data-testid="comment-card" data-user-href={userHref}>
                {headerActions}
                <div data-testid="comment-body">{children}</div>
                {footer}
            </div>
        ),
    };
}

/**
 * Factory for the MarkdownRenderer module mock. `testId` defaults to
 * "markdown-renderer"; pull-request-review.test.tsx uses "markdown".
 */
export function mockMarkdownRenderer(testId = "markdown-renderer") {
    return {
        MarkdownRenderer: ({ content }: { content: string }) => (
            <div data-testid={testId}>{content}</div>
        ),
    };
}

/** Factory for the ReactionBar module mock. */
export function mockReactionBar() {
    return {
        ReactionBar: () => <div data-testid="reaction-bar" />,
    };
}

/** Factory for the ReactionPicker module mock. */
export function mockReactionPicker() {
    return {
        ReactionPicker: () => <div data-testid="reaction-picker" />,
    };
}

/** Factory for the ui/popover module mock. */
export function mockPopover() {
    return {
        Popover: ({ children }: { children?: ReactNode }) => (
            <div>{children}</div>
        ),
        PopoverContent: ({ children }: { children?: ReactNode }) => (
            <div>{children}</div>
        ),
        PopoverTrigger: ({ children }: { children?: ReactNode }) => (
            <div>{children}</div>
        ),
    };
}

/**
 * Factory for the ui/dialog module mock. Slots named in `taggedSlots` render
 * a `data-testid` equal to their slot name (e.g. "dialog-content"); other
 * slots render a plain wrapper div.
 */
export function mockDialog(taggedSlots: string[] = []) {
    const slot =
        (key: string) =>
        ({ children }: { children?: ReactNode }) => (
            <div data-testid={taggedSlots.includes(key) ? key : undefined}>
                {children}
            </div>
        );
    return {
        Dialog: slot("dialog"),
        DialogContent: slot("dialog-content"),
        DialogDescription: slot("dialog-description"),
        DialogFooter: slot("dialog-footer"),
        DialogHeader: slot("dialog-header"),
        DialogTitle: slot("dialog-title"),
    };
}

/** Factory for the use-reaction-toggle hook mock. */
export function mockUseReactionToggle() {
    return {
        useTogglePullRequestReviewCommentReaction: vi.fn(() => ({
            mutate: vi.fn(),
            isPending: false,
        })),
    };
}

/** Factory for the use-review-thread-operations hook mock. */
export function mockUseReviewThreadOperations() {
    return {
        useReviewThreadOperations: vi.fn(() => ({
            operations: [],
            isPending: () => false,
            resolve: vi.fn(),
        })),
        applyReviewThreadOperations: vi.fn((threads: unknown) => threads),
    };
}
