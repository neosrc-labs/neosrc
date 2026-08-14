import { vi } from "vitest";

/** useUtils entry for reviewComments.list (cancel/invalidate/getData/setData). */
export function reviewCommentsListUtils() {
    return {
        cancel: vi.fn(),
        invalidate: vi.fn(),
        getData: vi.fn(() => []),
        setData: vi.fn(),
    };
}

/** useUtils entry for reactions.getForReviewComments. */
export function reviewCommentReactionsUtils() {
    return {
        cancel: vi.fn(),
        invalidate: vi.fn(),
        getData: vi.fn(() => ({})),
        setData: vi.fn(),
    };
}

/** users.currentUser query mock shared by comment-thread tests. */
export function currentUserApi() {
    return {
        users: {
            currentUser: {
                useQuery: vi.fn(() => ({
                    data: {
                        login: "testuser",
                        avatarUrl: "https://example.com/avatar.png",
                    },
                })),
            },
        },
    };
}

/** reactions.getForReviewComments query mock shared by comment-thread tests. */
export function commentReactionsApi() {
    return {
        reactions: {
            getForReviewComments: {
                useQuery: vi.fn(() => ({ data: {} })),
            },
        },
    };
}

/** reviewComments.reply/update/delete mutation mocks, plus optional threads query. */
export function reviewCommentMutationsApi(threadsQuery?: unknown) {
    return {
        reviewComments: {
            reply: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
            update: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
            delete: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
            ...(threadsQuery !== undefined
                ? { threads: { useQuery: threadsQuery } }
                : {}),
        },
    };
}

/** repos.getPermission query mock returning no permission. */
export function getPermissionApi() {
    return {
        repos: {
            getPermission: { useQuery: vi.fn(() => ({ data: null })) },
        },
    };
}

/**
 * Bundle of the api entries shared by the comment-thread test suites:
 * current user, comment reactions, reviewComment mutations (plus the threads
 * query) and repo permission.
 */
export function reviewThreadsApi(threadsQuery?: unknown) {
    return {
        ...currentUserApi(),
        ...commentReactionsApi(),
        ...reviewCommentMutationsApi(threadsQuery),
        ...getPermissionApi(),
    };
}

/** useUtils entry for stack tests (pulls.getStack/pulls.list invalidation). */
export function pullsStackUtils() {
    return {
        useUtils: vi.fn(() => ({
            pulls: {
                getStack: { invalidate: vi.fn() },
                list: { invalidate: vi.fn() },
            },
        })),
    };
}
