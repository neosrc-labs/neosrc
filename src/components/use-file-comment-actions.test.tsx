// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffCommentTarget } from "./diff/types";
import { useFileCommentActions } from "./use-file-comment-actions";

/**
 * Replaces the trpc layer with a shim reproducing the react-query mutation
 * contract and the two comment caches. `invalidate` mimics GitHub's read lag:
 * the refetched pending review comes back without the comment that was just
 * created. A regression where the optimistic comment is dropped after
 * creation (it vanishes until a later refetch) fails these tests.
 */
const mocks = vi.hoisted(() => {
    type Comment = {
        id: number;
        body: string;
        path: string;
        pull_request_review_id?: number | null;
    };
    type Pending = { reviewId: number; comments: Comment[] };
    type Options = Record<
        string,
        ((...args: unknown[]) => unknown) | undefined
    >;

    const state: { pending: Pending | null; list: Comment[] | null } = {
        pending: null,
        list: null,
    };

    const applyUpdater = <T,>(current: T, updater: unknown): T =>
        typeof updater === "function"
            ? (updater as (value: T) => T)(current)
            : (updater as T);

    const getPending = {
        cancel: vi.fn(async () => {}),
        getData: vi.fn(() => state.pending),
        setData: vi.fn((_key: unknown, updater: unknown) => {
            state.pending = applyUpdater(state.pending, updater);
        }),
        invalidate: vi.fn(() => {
            state.pending = {
                reviewId: state.pending?.reviewId ?? 0,
                comments: [],
            };
        }),
    };
    const list = {
        cancel: vi.fn(async () => {}),
        getData: vi.fn(() => state.list),
        setData: vi.fn((_key: unknown, updater: unknown) => {
            state.list = applyUpdater(state.list, updater);
        }),
        invalidate: vi.fn(() => {
            state.list = [];
        }),
    };

    const runCreate = vi.fn(async () => ({ success: true as const, id: 777 }));
    const runStart = vi.fn(async () => ({ reviewId: 555 }));

    const makeUseMutation =
        (run: (input: unknown) => Promise<unknown>) => (options: Options) => ({
            mutate: (input: unknown, callOptions?: Options) => {
                void (async () => {
                    const opts = { ...options, ...callOptions };
                    const context = await opts.onMutate?.(input);
                    let error: unknown;
                    try {
                        const data = await run(input);
                        opts.onSuccess?.(data, input, context);
                    } catch (err) {
                        error = err;
                        opts.onError?.(err, input, context);
                    }
                    opts.onSettled?.(undefined, error, input, context);
                })();
            },
            isPending: false,
            isError: false,
        });

    return {
        state,
        utils: { reviews: { getPending }, reviewComments: { list } },
        runCreate,
        runStart,
        createUseMutation: makeUseMutation(runCreate),
        startUseMutation: makeUseMutation(runStart),
    };
});

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => mocks.utils,
        users: {
            currentUser: {
                useQuery: () => ({
                    data: {
                        login: "octocat",
                        avatarUrl: "https://example.com/avatar.png",
                    },
                }),
            },
        },
        reviewComments: {
            create: { useMutation: mocks.createUseMutation },
        },
        reviews: {
            start: { useMutation: mocks.startUseMutation },
        },
    },
}));

function Harness({ pendingReviewId }: { pendingReviewId?: number | null }) {
    const [activeComment, setActiveComment] =
        useState<DiffCommentTarget | null>({
            type: "line",
            line: 3,
            side: "RIGHT",
        });
    const [commentBody, setCommentBody] = useState("a fresh comment");
    const recentlyAddedIds = useRef(new Set<number>());

    const { footerActions } = useFileCommentActions({
        owner: "octo",
        repo: "repo",
        number: "7",
        filename: "src/file.ts",
        pendingReviewId,
        showComments: true,
        commentBody,
        activeComment,
        recentlyAddedIds,
        setActiveComment,
        setCommentBody,
        onCommentSuccess: () => {},
    });

    return (
        <div>
            {footerActions.map((action) => (
                <button
                    key={action.label}
                    type="button"
                    onClick={() => action.onClick()}
                >
                    {action.label}
                </button>
            ))}
        </div>
    );
}

beforeEach(() => {
    mocks.state.pending = null;
    mocks.state.list = null;
    mocks.runCreate.mockClear();
    mocks.runStart.mockClear();
});

describe("useFileCommentActions optimistic comment", () => {
    it("keeps the comment after it is added to an existing pending review", async () => {
        mocks.state.pending = { reviewId: 42, comments: [] };
        render(<Harness pendingReviewId={42} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Add to Review" }),
        );

        await waitFor(() => {
            expect(mocks.state.pending?.comments).toHaveLength(1);
        });
        const [comment] = mocks.state.pending?.comments ?? [];
        expect(comment?.id).toBe(777);
        expect(comment?.body).toBe("a fresh comment");
        expect(comment?.path).toBe("src/file.ts");
        expect(comment?.pull_request_review_id).toBe(42);
        expect(mocks.state.pending?.reviewId).toBe(42);
    });

    it("keeps the comment while the pending review is started", async () => {
        render(<Harness pendingReviewId={undefined} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Start a Review" }),
        );

        await waitFor(() => {
            expect(mocks.runStart).toHaveBeenCalledTimes(1);
            expect(mocks.runCreate).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(mocks.state.pending?.comments).toHaveLength(1);
        });
        const [comment] = mocks.state.pending?.comments ?? [];
        expect(comment?.id).toBe(777);
        expect(comment?.body).toBe("a fresh comment");
        expect(comment?.pull_request_review_id).toBe(555);
        expect(mocks.state.pending?.reviewId).toBe(555);
    });

    it("clears the optimistic comment when the write fails", async () => {
        mocks.state.pending = { reviewId: 42, comments: [] };
        mocks.runCreate.mockRejectedValueOnce(new Error("boom"));
        render(<Harness pendingReviewId={42} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Add to Review" }),
        );

        await waitFor(() => {
            expect(mocks.state.pending?.comments ?? []).toHaveLength(0);
        });
    });
});
