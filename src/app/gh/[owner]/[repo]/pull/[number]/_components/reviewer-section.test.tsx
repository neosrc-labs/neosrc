// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockDialog, mockPopover } from "~/__tests__/helpers/component-mocks";
import type { PullsGetResponseData, ReviewComment2 } from "~/server/github";
import { ReviewerSection } from "./reviewer-section";

const mocks = vi.hoisted(() => ({
    dismissMutate: vi.fn(),
    reviews: [] as unknown[],
}));

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => ({
            timeline: { list: { invalidate: vi.fn() } },
            pulls: {
                listReviews: { invalidate: vi.fn() },
                getMergeState: { invalidate: vi.fn() },
            },
        }),
        pulls: {
            listAssignees: { useQuery: () => ({ data: [] }) },
            addReviewer: { useMutation: () => ({ mutate: vi.fn() }) },
            removeReviewer: { useMutation: () => ({ mutate: vi.fn() }) },
            listReviews: {
                useQuery: () => ({ data: mocks.reviews, isPending: false }),
            },
            getMergeRequirements: {
                useQuery: () => ({
                    data: { requiredApprovingReviewCount: 0 },
                    isPending: false,
                }),
            },
            getMergeState: { useQuery: () => ({ data: null }) },
        },
        reviews: {
            dismiss: {
                useMutation: (opts?: { onSuccess?: () => void }) => ({
                    mutate: (args: unknown) => {
                        mocks.dismissMutate(args);
                        opts?.onSuccess?.();
                    },
                    isPending: false,
                    isError: false,
                }),
            },
        },
    },
}));

vi.mock("next/image", () => ({
    default: ({ src, alt }: { src: string; alt: string }) => (
        // biome-ignore lint/performance/noImgElement: test double for next/image
        <img alt={alt} src={src} />
    ),
}));

vi.mock("~/components/ui/tooltip", () => ({
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    TooltipContent: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    TooltipProvider: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
}));

vi.mock("~/components/ui/popover", () => mockPopover());

vi.mock("~/components/ui/dialog", () => mockDialog(["dialog-content"]));

vi.mock("~/components/ui/searchable-dropdown", () => ({
    SearchableDropdown: () => <div />,
}));

vi.mock("~/components/hovercards/user-hover-card", () => ({
    UserHoverCard: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

vi.mock("./metadata-section", () => ({
    FieldSkeleton: () => <div data-testid="field-skeleton" />,
}));

function resolvedPromise<T>(value: T): Promise<T> {
    const promise = Promise.resolve(value);
    const tracked = promise as Promise<T> & {
        status: "fulfilled";
        value: T;
    };
    tracked.status = "fulfilled";
    tracked.value = value;
    return promise;
}

function makeReview(overrides: Partial<ReviewComment2> = {}): ReviewComment2 {
    return {
        id: 11,
        user: { login: "alice" },
        state: "APPROVED",
        submitted_at: "2026-08-02T07:45:06Z",
        ...overrides,
    } as unknown as ReviewComment2;
}

function renderSection({
    reviews,
    repoPermission = "write",
}: {
    reviews: ReviewComment2[];
    repoPermission?: "admin" | "write" | "read" | "none";
}) {
    mocks.reviews = reviews;
    return render(
        <ReviewerSection
            pullRequestPromise={resolvedPromise({
                user: { login: "author" },
                requested_reviewers: [],
            } as unknown as PullsGetResponseData)}
            permissionContextPromise={resolvedPromise({
                isPullRequestLocked: false,
                isPullRequestAuthor: false,
                repoPermission,
                currentUser: "testuser",
            })}
            owner="owner"
            repo="repo"
            number={1}
        />,
    );
}

describe("ReviewerSection review dismissal", () => {
    it("offers Dismiss review for a bodyless approval with push access", async () => {
        renderSection({ reviews: [makeReview()] });

        expect(
            await screen.findByLabelText("More options for alice"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Dismiss review" }),
        ).toBeInTheDocument();
    });

    it("dismisses the review with the entered message", async () => {
        const user = userEvent.setup();
        renderSection({
            reviews: [makeReview({ id: 42, state: "CHANGES_REQUESTED" })],
        });

        expect(
            await screen.findByLabelText("More options for alice"),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Dismiss review" }),
        );

        const dialog = screen.getByTestId("dialog-content");
        const submit = within(dialog).getByRole("button", {
            name: "Dismiss review",
        });
        expect(submit).toHaveAttribute("data-variant", "destructive");
        expect(submit).toBeDisabled();

        await user.type(
            within(dialog).getByLabelText("Reason for dismissing this review"),
            "Addressed on main",
        );
        await user.click(submit);

        expect(mocks.dismissMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
            reviewId: 42,
            message: "Addressed on main",
        });
    });

    it("does not offer Dismiss review without push access", async () => {
        renderSection({
            reviews: [makeReview()],
            repoPermission: "read",
        });

        await screen.findByText("alice");
        expect(
            screen.queryByLabelText("More options for alice"),
        ).not.toBeInTheDocument();
    });

    it("does not offer Dismiss review for a comment-only review", async () => {
        renderSection({ reviews: [makeReview({ state: "COMMENTED" })] });

        await screen.findByText("alice");
        expect(
            screen.queryByLabelText("More options for alice"),
        ).not.toBeInTheDocument();
    });

    it("does not offer Dismiss review after the decision was dismissed", async () => {
        renderSection({
            reviews: [
                makeReview({ id: 1, state: "APPROVED" }),
                makeReview({ id: 2, state: "DISMISSED" }),
            ],
        });

        await screen.findByText("alice");
        expect(
            screen.queryByLabelText("More options for alice"),
        ).not.toBeInTheDocument();
        // A dismissed review must not read as a pending request.
        expect(
            screen.queryByText(/Awaiting requested review/),
        ).not.toBeInTheDocument();
    });
});
