// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { TimelineResult } from "~/server/api/routers/timeline";
import {
    applyReactionToggle,
    useCommentTaskToggle,
    useIssueCommentReactionToggle,
    usePullRequestReviewReactionToggle,
    useReviewTaskToggle,
    useSavedBodies,
    useUpdateCommentBody,
    useUpdateReviewBody,
} from "./use-timeline-comment-actions";

/**
 * The trpc layer is replaced with a small shim that reproduces the
 * react-query mutation contract this module relies on: onMutate's return
 * value becomes the error/settled context, and onError fires when the
 * registered mutator rejects.
 */
const mocks = vi.hoisted(() => {
    type Options = Record<string, ((...args: never[]) => unknown) | undefined>;
    const list = {
        cancel: vi.fn(async () => {}),
        getInfiniteData: vi.fn<() => unknown>(() => undefined),
        setInfiniteData: vi.fn(),
        invalidate: vi.fn(),
    };
    const utils = { timeline: { list } };
    const mutators = {
        "pulls.updateComment": vi.fn((input: unknown) =>
            Promise.resolve(input),
        ),
        "pulls.updateReview": vi.fn((input: unknown) => Promise.resolve(input)),
        "reactions.toggleIssueComment": vi.fn(() =>
            Promise.resolve({ action: "added" }),
        ),
        "reactions.togglePullRequestReview": vi.fn(() =>
            Promise.resolve({ action: "added" }),
        ),
    };
    const makeUseMutation =
        (key: keyof typeof mutators) =>
        (options: Options & Record<string, unknown>) => ({
            mutate: (input: unknown) => {
                void (async () => {
                    try {
                        const context = await (
                            options.onMutate as
                                | ((v: unknown) => unknown)
                                | undefined
                        )?.(input);
                        try {
                            const data = await mutators[key](input);
                            (
                                options.onSuccess as
                                    | ((...a: unknown[]) => void)
                                    | undefined
                            )?.(data, input, context);
                        } catch (error) {
                            (
                                options.onError as
                                    | ((...a: unknown[]) => void)
                                    | undefined
                            )?.(error, input, context);
                        }
                        (
                            options.onSettled as
                                | ((...a: unknown[]) => void)
                                | undefined
                        )?.(undefined, undefined, input, context);
                    } catch {
                        // onMutate threw; nothing further to simulate.
                    }
                })();
            },
            isPending: false,
            isError: false,
        });
    return { utils, mutators, makeUseMutation };
});

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => mocks.utils,
        pulls: {
            updateComment: {
                useMutation: mocks.makeUseMutation("pulls.updateComment"),
            },
            updateReview: {
                useMutation: mocks.makeUseMutation("pulls.updateReview"),
            },
        },
        reactions: {
            toggleIssueComment: {
                useMutation: mocks.makeUseMutation(
                    "reactions.toggleIssueComment",
                ),
            },
            togglePullRequestReview: {
                useMutation: mocks.makeUseMutation(
                    "reactions.togglePullRequestReview",
                ),
            },
        },
    },
}));

const { mutators } = mocks;
const utils = mocks.utils.timeline.list;

const SCOPE = { owner: "octo", repo: "repo", number: 7 };

function makePage(
    commentReactions: TimelineResult["commentReactions"],
): TimelineResult {
    return {
        events: [],
        nextCursor: undefined,
        commentReactions,
        currentUserLogin: undefined,
        mergeQueueEntry: null,
    };
}

function reactionNode(login: string, content: string, databaseId: number) {
    return {
        databaseId,
        content,
        createdAt: "2026-01-01T00:00:00Z",
        user: { login },
    };
}

function renderWithClient(ui: ReactElement) {
    return render(ui);
}

function CommentReactionHarness({
    currentUserLogin,
}: {
    currentUserLogin: string | null;
}) {
    const mutation = useIssueCommentReactionToggle(SCOPE, currentUserLogin);
    return (
        <button
            onClick={() =>
                mutation.mutate({
                    owner: SCOPE.owner,
                    repo: SCOPE.repo,
                    commentId: 101,
                    content: "heart",
                })
            }
            type="button"
        >
            react
        </button>
    );
}

function ReviewReactionHarness({
    currentUserLogin,
    databaseId,
}: {
    currentUserLogin: string | null;
    databaseId?: number;
}) {
    const mutation = usePullRequestReviewReactionToggle(
        SCOPE,
        currentUserLogin,
    );
    return (
        <button
            onClick={() =>
                mutation.mutate({
                    subjectId: "PRR_kwDOABC",
                    content: "heart",
                    databaseId,
                })
            }
            type="button"
        >
            react
        </button>
    );
}

function click(name: string) {
    return userEvent.click(screen.getByRole("button", { name }));
}

async function clickReactAndSettle() {
    await click("react");
    await waitFor(() => expect(utils.invalidate).toHaveBeenCalled());
}

function capturedUpdater() {
    const calls = utils.setInfiniteData.mock.calls;
    const last = calls[calls.length - 1] ?? [];
    return { input: last[0], updater: last[1] };
}

beforeEach(() => {
    for (const fn of Object.values(utils)) {
        fn.mockClear();
    }
    for (const fn of Object.values(mutators)) {
        fn.mockClear();
    }
    utils.getInfiniteData.mockImplementation(() => undefined);
});

describe("reaction toggle factories", () => {
    it("adds the current user's reaction to every cached page under comment:<id>", async () => {
        const data = {
            pages: [
                makePage({
                    "comment:101": [reactionNode("bob", "+1", 1)],
                }),
                makePage({
                    "comment:101": [],
                    "comment:999": [reactionNode("bob", "heart", 2)],
                }),
            ],
            pageParams: [null],
        };
        utils.getInfiniteData.mockImplementation(() => data);

        renderWithClient(<CommentReactionHarness currentUserLogin="alice" />);
        await clickReactAndSettle();

        expect(mutators["reactions.toggleIssueComment"]).toHaveBeenCalledWith({
            owner: "octo",
            repo: "repo",
            commentId: 101,
            content: "heart",
        });

        const { input, updater } = capturedUpdater();
        expect(input).toEqual({ ...SCOPE, limit: TIMELINE_PAGE_SIZE });

        const next = updater(data);
        const updated = next.pages[0]?.commentReactions["comment:101"];
        expect(updated?.[0]).toEqual(reactionNode("bob", "+1", 1));
        expect(updated?.[1]).toMatchObject({
            content: "heart",
            user: { login: "alice" },
        });
        expect(updated?.[1]?.databaseId).toBeLessThan(0);
        expect(next.pages[1]?.commentReactions["comment:101"]).toHaveLength(1);
        expect(next.pages[1]?.commentReactions["comment:999"]).toEqual([
            reactionNode("bob", "heart", 2),
        ]);
    });

    it("removes the current user's matching reaction instead of duplicating it", () => {
        const data = {
            pages: [
                makePage({
                    "comment:101": [
                        reactionNode("bob", "heart", 2),
                        reactionNode("alice", "heart", 5),
                    ],
                }),
            ],
            pageParams: [null],
        };

        const next = applyReactionToggle(data, "comment:101", "alice", "heart");

        expect(next.pages[0]?.commentReactions["comment:101"]).toEqual([
            reactionNode("bob", "heart", 2),
        ]);
    });

    it("keeps pages without the subject key referentially intact", () => {
        const untouched = makePage({});
        const withSubject = makePage({ "comment:101": [] });
        const data = { pages: [untouched, withSubject], pageParams: [null] };

        const next = applyReactionToggle(data, "comment:101", "alice", "heart");

        expect(next.pages[0]).toBe(untouched);
        expect(next.pages[1]).not.toBe(withSubject);
        expect(next.pages[1]?.commentReactions["comment:101"]).toHaveLength(1);
    });

    it("keys review reactions by review:<databaseId>", async () => {
        const data = {
            pages: [
                makePage({
                    "review:55": [reactionNode("bob", "heart", 2)],
                }),
            ],
            pageParams: [null],
        };
        utils.getInfiniteData.mockImplementation(() => data);

        renderWithClient(
            <ReviewReactionHarness currentUserLogin="alice" databaseId={55} />,
        );
        await clickReactAndSettle();

        const { updater } = capturedUpdater();
        const next = updater(data);
        const logins = (r: { user?: { login: string } | null }) =>
            r.user?.login;
        expect(
            next.pages[0]?.commentReactions["review:55"]?.map(logins),
        ).toEqual(["bob", "alice"]);
    });

    it("skips the optimistic cache write without a signed-in user", async () => {
        renderWithClient(<CommentReactionHarness currentUserLogin={null} />);
        await click("react");

        expect(utils.cancel).not.toHaveBeenCalled();
        expect(utils.setInfiniteData).not.toHaveBeenCalled();
        expect(utils.invalidate).toHaveBeenCalled();
    });

    it("skips the optimistic cache write when a review has no databaseId", async () => {
        renderWithClient(<ReviewReactionHarness currentUserLogin="alice" />);
        await click("react");

        expect(utils.cancel).not.toHaveBeenCalled();
        expect(utils.setInfiniteData).not.toHaveBeenCalled();
    });

    it("restores the snapshot when the request fails", async () => {
        const data = {
            pages: [makePage({ "comment:101": [] })],
            pageParams: [null],
        };
        utils.getInfiniteData.mockImplementation(() => data);
        mutators["reactions.toggleIssueComment"].mockRejectedValueOnce(
            new Error("boom"),
        );

        renderWithClient(<CommentReactionHarness currentUserLogin="alice" />);
        await click("react");

        await waitFor(() =>
            expect(utils.setInfiniteData).toHaveBeenCalledTimes(2),
        );
        const rollback = utils.setInfiniteData.mock.calls[1] ?? [];
        expect(rollback[0]).toEqual({ ...SCOPE, limit: TIMELINE_PAGE_SIZE });
        expect(rollback[1]).toBe(data);
    });
});

type BodyVariant = "comment" | "review" | "comment-toggle" | "review-toggle";

function UpdateBodyHarness({ variant }: { variant: BodyVariant }) {
    const store = useSavedBodies();
    const [closedCount, setClosedCount] = useState(0);
    const [resumedId, setResumedId] = useState<number | null>(null);
    const transitions = {
        onSaved: () => setClosedCount((c) => c + 1),
        onResumeEdit: (id: number) => setResumedId(id),
    };
    const updateComment = useUpdateCommentBody(store, transitions);
    const updateReview = useUpdateReviewBody(store, transitions);
    const commentToggle = useCommentTaskToggle(store);
    const reviewToggle = useReviewTaskToggle(store);

    const run = () => {
        switch (variant) {
            case "comment":
                updateComment.mutate({
                    owner: SCOPE.owner,
                    repo: SCOPE.repo,
                    commentId: 9,
                    body: "edited",
                });
                break;
            case "review":
                updateReview.mutate({
                    owner: SCOPE.owner,
                    repo: SCOPE.repo,
                    number: SCOPE.number,
                    reviewId: 9,
                    body: "edited",
                });
                break;
            case "comment-toggle":
                commentToggle.mutate({
                    owner: SCOPE.owner,
                    repo: SCOPE.repo,
                    commentId: 9,
                    body: "toggled",
                });
                break;
            case "review-toggle":
                reviewToggle.mutate({
                    owner: SCOPE.owner,
                    repo: SCOPE.repo,
                    number: SCOPE.number,
                    reviewId: 9,
                    body: "toggled",
                });
                break;
        }
    };

    return (
        <>
            <span>saving:{JSON.stringify(store.savedBodies)}</span>
            <span>closed:{closedCount}</span>
            <span>resumed:{resumedId ?? "none"}</span>
            <button onClick={run} type="button">
                save
            </button>
        </>
    );
}

function updateKey(variant: BodyVariant) {
    return variant === "comment" || variant === "comment-toggle"
        ? "pulls.updateComment"
        : "pulls.updateReview";
}

async function clickSaveWithFailure(variant: BodyVariant) {
    mutators[updateKey(variant)].mockRejectedValueOnce(new Error("boom"));
    await click("save");
}

describe.each(["comment", "review"] as const)(
    "update body factory (%s)",
    (variant) => {
        it("saves the body optimistically and closes the editor", async () => {
            render(<UpdateBodyHarness variant={variant} />);
            await click("save");

            await waitFor(() =>
                expect(
                    screen.getByText('saving:{"9":"edited"}'),
                ).toBeInTheDocument(),
            );
            expect(screen.getByText("closed:1")).toBeInTheDocument();
            expect(screen.getByText("resumed:none")).toBeInTheDocument();
        });

        it("discards the saved body and reopens the editor on failure", async () => {
            render(<UpdateBodyHarness variant={variant} />);
            await clickSaveWithFailure(variant);

            await waitFor(() =>
                expect(screen.getByText("saving:{}")).toBeInTheDocument(),
            );
            expect(screen.getByText("closed:1")).toBeInTheDocument();
            expect(screen.getByText("resumed:9")).toBeInTheDocument();
        });
    },
);

describe.each(["comment-toggle", "review-toggle"] as const)(
    "task toggle factory (%s)",
    (variant) => {
        it("overlays the body without touching editor state, and discards on failure", async () => {
            render(<UpdateBodyHarness variant={variant} />);
            await clickSaveWithFailure(variant);

            await waitFor(() =>
                expect(screen.getByText("saving:{}")).toBeInTheDocument(),
            );
            expect(screen.getByText("closed:0")).toBeInTheDocument();
            expect(screen.getByText("resumed:none")).toBeInTheDocument();
            expect(mutators[updateKey(variant)]).toHaveBeenCalledWith(
                variant === "comment-toggle"
                    ? {
                          owner: SCOPE.owner,
                          repo: SCOPE.repo,
                          commentId: 9,
                          body: "toggled",
                      }
                    : {
                          owner: SCOPE.owner,
                          repo: SCOPE.repo,
                          number: SCOPE.number,
                          reviewId: 9,
                          body: "toggled",
                      },
            );
        });
    },
);
