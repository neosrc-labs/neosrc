"use client";

import type { Dispatch, SetStateAction } from "react";

type SavedBodies = Record<number, string>;

interface SavedBodyMutationHandlersOptions<K extends "commentId" | "reviewId"> {
    /** Which variable in the mutation input carries the entity id. */
    idKey: K;
    setSavedBodies: Dispatch<SetStateAction<SavedBodies>>;
    /** When provided, the edit flow also opens/closes the editing state. */
    setEditingCommentId?: Dispatch<SetStateAction<number | null>>;
}

type SavedBodyMutationVars<K extends "commentId" | "reviewId"> = Record<
    K,
    number
> & { body: string };

/**
 * Shared `onMutate`/`onError` wiring for mutations that optimistically apply a
 * full comment/review body (edit saves and task-list checkbox toggles). Every
 * comment surface in the app keeps a `savedBodies` overlay keyed by entity id:
 * on mutate the new body is applied optimistically, on error it is rolled back.
 *
 * Pass `setEditingCommentId` for edit-save mutations (they close the editor on
 * success and reopen it on failure); omit it for task-toggle mutations (they
 * only overlay the body without touching edit state).
 */
export function savedBodyMutationHandlers<K extends "commentId" | "reviewId">({
    idKey,
    setSavedBodies,
    setEditingCommentId,
}: SavedBodyMutationHandlersOptions<K>) {
    const idOf = (vars: SavedBodyMutationVars<K>) => vars[idKey];

    return {
        onMutate: (vars: SavedBodyMutationVars<K>) => {
            setSavedBodies((prev) => ({ ...prev, [idOf(vars)]: vars.body }));
            setEditingCommentId?.(null);
        },
        onError: (_err: unknown, vars: SavedBodyMutationVars<K>) => {
            const id = idOf(vars);
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setEditingCommentId?.(id);
        },
    };
}
