"use client";

import type { ReactNode } from "react";
import { CommentCard } from "~/components/comment-card";

interface TimelineCommentCardProps {
    id: string;
    user: { login: string; avatar_url: string } | null;
    userHref?: string;
    /** Entity id used to wire the edit-save callback. */
    databaseId: number;
    createdAt: string;
    authorAssociation?: string | null;
    isEditing: boolean;
    editBody: string;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    /** Receives the entity id and the current edit body. */
    onSaveEdit: (id: number, body: string) => void;
    owner: string;
    repo: string;
    tailDirection: "left" | "up";
    headerActions?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
}

/**
 * Standalone speech-bubble comment card used by timeline event content
 * (issue comments and pull request reviews). Fixes the shared presentation
 * (standalone variant, hidden avatar, tail direction) and wires the common
 * edit-save flow against `databaseId`.
 */
export function TimelineCommentCard({
    id,
    user,
    userHref,
    databaseId,
    createdAt,
    authorAssociation,
    isEditing,
    editBody,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    owner,
    repo,
    tailDirection,
    headerActions,
    footer,
    children,
}: TimelineCommentCardProps) {
    return (
        <CommentCard
            id={id}
            user={user}
            variant="standalone"
            hideAvatar
            tailDirection={tailDirection}
            userHref={userHref}
            createdAt={createdAt}
            authorAssociation={authorAssociation}
            isEditing={isEditing}
            editBody={editBody}
            onEditBodyChange={onEditBodyChange}
            onCancelEdit={onCancelEdit}
            onSaveEdit={() => onSaveEdit(databaseId, editBody)}
            owner={owner}
            repo={repo}
            headerActions={headerActions}
            footer={footer}
        >
            {children}
        </CommentCard>
    );
}
