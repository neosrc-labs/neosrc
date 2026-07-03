"use client";

import { useCallback, useRef } from "react";

/**
 * Public surface of a tRPC mutation that the task-toggle hook can drive. Each
 * consumer constructs its own {@link import("~/trpc/react").api.<router>.<procedure>.useMutation}
 * instance, wires the optimistic application (e.g. `setSavedBody`) and the
 * rollback (e.g. revert the optimistic state) inside that mutation's
 * `onMutate`/`onError` callbacks, and then passes the resulting `mutate` and
 * `isPending` here. The hook shields the renderer from those details so the
 * same {@link MarkdownRenderer} `onToggleTask` contract works for pull request
 * bodies, review comments, and any future consumer.
 *
 * @example
 * const updateBody = api.pulls.updateBody.useMutation({
 *     onMutate: ({ body }) => setSavedBody(body),
 *     onError: () => setSavedBody(null),
 * });
 * const { onToggleTask } = useTaskToggle({
 *     mutation: { mutate: updateBody.mutate, isPending: updateBody.isPending },
 *     staticInput: { owner, repo, number },
 * });
 * <MarkdownRenderer content={body} onToggleTask={onToggleTask} canToggleTasks={canEdit} />
 */
export interface TaskToggleApi<TInput extends { body: string }> {
    mutate: (input: TInput) => void;
    isPending: boolean;
}

export interface UseTaskToggleOptions<TInput extends { body: string }> {
    /** The tRPC mutation entry this hook should invoke on each toggle. */
    mutation: TaskToggleApi<TInput>;
    /** The portion of the mutation input that does not change per toggle. */
    staticInput: Omit<TInput, "body">;
}

/**
 * Wires a {@link MarkdownRenderer} `onToggleTask` callback to a tRPC mutation
 * that persists a full body containing the toggled checkbox. Guards against
 * concurrent toggles while a previous toggle is still in flight — rapid clicks
 * are dropped rather than queued, since GitHub rewrites the whole body and
 * interleaving full-body writes would corrupt the markdown.
 */
export function useTaskToggle<TInput extends { body: string }>({
    mutation,
    staticInput,
}: UseTaskToggleOptions<TInput>) {
    const apiRef = useRef(mutation);
    apiRef.current = mutation;

    const onToggleTask = useCallback(
        (newContent: string) => {
            const current = apiRef.current;
            if (current.isPending) return;
            current.mutate({ ...staticInput, body: newContent } as TInput);
        },
        [staticInput],
    );

    return { onToggleTask, isPending: mutation.isPending };
}
