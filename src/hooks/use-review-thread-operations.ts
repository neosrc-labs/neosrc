import { useEffect, useState } from "react";
import { opId } from "~/lib/utils";
import type { ReviewThreadData } from "~/server/github";
import { api } from "~/trpc/react";

export type ReviewThreadOperation = {
    id: number;
    type: "setResolved";
    threadId: string;
    resolved: boolean;
};
// Future operations (addComment, editComment, ...) can be added as new union
// members and handled in the switch below.

export function applyReviewThreadOperations(
    threads: ReviewThreadData[] | undefined,
    operations: ReviewThreadOperation[],
): ReviewThreadData[] | undefined {
    if (!threads) return threads;
    const resolvedOverrides = new Map<string, boolean>();
    for (const op of operations) {
        switch (op.type) {
            case "setResolved":
                // Latest op wins per threadId.
                resolvedOverrides.set(op.threadId, op.resolved);
                break;
        }
    }
    return threads.map((thread) => {
        const override = resolvedOverrides.get(thread.id);
        if (override === undefined || override === thread.isResolved) {
            return thread;
        }
        return { ...thread, isResolved: override };
    });
}

export function useReviewThreadOperations({
    owner,
    repo,
    number,
}: {
    owner: string;
    repo: string;
    number: number;
}) {
    const utils = api.useUtils();
    const [operations, setOperations] = useState<ReviewThreadOperation[]>([]);
    const [pendingThreadIds, setPendingThreadIds] = useState<Set<string>>(
        new Set(),
    );

    const cacheKey = `${owner}/${repo}/${number}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: when the PR changes we reset the operations
    useEffect(() => {
        setOperations([]);
        setPendingThreadIds(new Set());
    }, [cacheKey]);

    const resolveMutation = api.reviewComments.resolveThread.useMutation({
        onMutate: ({ threadId, resolve }) => {
            const id = opId();
            setOperations((prev) => [
                ...prev,
                { id, type: "setResolved", threadId, resolved: resolve },
            ]);
            setPendingThreadIds((prev) => new Set(prev).add(threadId));
            return { opId: id, threadId };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.opId != null) {
                setOperations((prev) =>
                    prev.filter((op) => op.id !== ctx.opId),
                );
            }
            if (ctx?.threadId != null) {
                setPendingThreadIds((prev) => {
                    const next = new Set(prev);
                    next.delete(ctx.threadId);
                    return next;
                });
            }
        },
        onSettled: (_data, _err, vars) => {
            setPendingThreadIds((prev) => {
                const next = new Set(prev);
                next.delete(vars.threadId);
                return next;
            });
            utils.reviewComments.threads.invalidate({ owner, repo, number });
            utils.reviewComments.threadsPage.invalidate({
                owner,
                repo,
                number,
            });
            utils.reviewComments.list.invalidate({ owner, repo, number });
        },
    });

    return {
        operations,
        resolve: resolveMutation.mutate,
        isPending: (threadId: string) => pendingThreadIds.has(threadId),
    };
}
