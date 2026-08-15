"use client";

import { useCallback, useState } from "react";
import { api } from "~/trpc/react";

export function useReviewCommentEdit({
    owner,
    repo,
    number,
}: {
    owner: string;
    repo: string;
    number: number;
}) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});

    const updateMutation = api.reviewComments.update.useMutation({
        onMutate: ({ commentId, body }) => {
            setSavedBodies((previous) => ({ ...previous, [commentId]: body }));
            setEditingCommentId(null);
        },
        onError: (_, { commentId }) => {
            setSavedBodies((previous) => {
                const next = { ...previous };
                delete next[commentId];
                return next;
            });
            setEditingCommentId(commentId);
        },
    });

    const taskToggleMutation = api.reviewComments.update.useMutation({
        onMutate: ({ commentId, body }) => {
            setSavedBodies((previous) => ({ ...previous, [commentId]: body }));
        },
        onError: (_, { commentId }) => {
            setSavedBodies((previous) => {
                const next = { ...previous };
                delete next[commentId];
                return next;
            });
        },
    });

    const startEdit = useCallback((commentId: number, body: string) => {
        setEditBody(body);
        setEditingCommentId(commentId);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingCommentId(null);
        setEditBody("");
    }, []);

    const saveEdit = useCallback(
        (commentId: number) => {
            if (!editBody.trim()) return;
            updateMutation.mutate({
                owner,
                repo,
                number,
                commentId,
                body: editBody,
            });
        },
        [editBody, number, owner, repo, updateMutation],
    );

    return {
        editingCommentId,
        editBody,
        savedBodies,
        updateMutation,
        taskToggleMutation,
        startEdit,
        setEditBody,
        cancelEdit,
        saveEdit,
    };
}
