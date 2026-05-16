"use client";

import type { ReactNode } from "react";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { UserHoverCard } from "~/components/user-hover-card";
import { formatRelativeTime } from "~/utils";

const authorAssociationLabels: Record<string, string> = {
    COLLABORATOR: "Collaborator",
    CONTRIBUTOR: "Contributor",
    FIRST_TIMER: "First Timer",
    FIRST_TIME_CONTRIBUTOR: "First-time Contributor",
    MANNEQUIN: "Mannequin",
    MEMBER: "Member",
    OWNER: "Owner",
};

const neutralBadge =
    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400";

const authorAssociationStyles: Record<string, string> = {
    OWNER: neutralBadge,
    MEMBER: neutralBadge,
    COLLABORATOR: neutralBadge,
    CONTRIBUTOR: neutralBadge,
    FIRST_TIMER: neutralBadge,
    FIRST_TIME_CONTRIBUTOR: neutralBadge,
    MANNEQUIN: neutralBadge,
};

interface CommentCardProps {
    user: { login: string; avatar_url: string } | null;
    userHref?: string;
    createdAt: string;
    authorAssociation?: string | null;
    isPending?: boolean;
    isEditing?: boolean;
    editBody?: string;
    onEditBodyChange?: (body: string) => void;
    onCancelEdit?: () => void;
    onSaveEdit?: () => void;
    headerActions?: ReactNode;
    footer?: ReactNode;
    owner: string;
    repo: string;
    children?: ReactNode;
    variant?: "default" | "nested" | "standalone";
}

export function CommentCard({
    user,
    userHref,
    createdAt,
    authorAssociation,
    isPending,
    isEditing,
    editBody = "",
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    headerActions,
    footer,
    owner,
    repo,
    children,
    variant = "default",
}: CommentCardProps) {
    const userElement = user && (
        <>
            <img
                alt={user.login ?? "user"}
                className="h-5 w-5 flex-shrink-0 rounded-full"
                src={user.avatar_url ?? ""}
            />
            <span className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
                {user.login ?? "unknown"}
            </span>
        </>
    );

    return (
        <div
            className={
                variant === "default"
                    ? "border-b-1 border-b-gray-200 border-solid bg-white dark:border-b-zinc-700 dark:bg-zinc-900"
                    : variant === "standalone"
                      ? "rounded border-1 border-gray-200 border-solid bg-white dark:border-zinc-700 dark:bg-zinc-900"
                      : "bg-gray-50 dark:bg-zinc-950"
            }
        >
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                    {user && userHref ? (
                        <UserHoverCard login={user.login}>
                            <a
                                className="flex items-center gap-2"
                                href={userHref}
                            >
                                {userElement}
                            </a>
                        </UserHoverCard>
                    ) : (
                        userElement
                    )}
                    <span className="whitespace-nowrap text-gray-500 text-xs">
                        {formatRelativeTime(createdAt)}
                    </span>
                    {isPending && (
                        <span className="whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Pending
                        </span>
                    )}
                    {authorAssociation && authorAssociation !== "NONE" && (
                        <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-xs ${
                                authorAssociationStyles[authorAssociation] ??
                                neutralBadge
                            }`}
                        >
                            {authorAssociationLabels[authorAssociation] ??
                                authorAssociation}
                        </span>
                    )}
                </div>
                {!isEditing && headerActions && (
                    <div className="flex flex-shrink-0 items-center gap-0.5">
                        {headerActions}
                    </div>
                )}
            </div>
            <div className="prose prose-sm dark:prose-invert mx-6 max-w-none px-4 py-2">
                {isEditing ? (
                    <MarkdownEditor
                        value={editBody}
                        onChange={onEditBodyChange ?? (() => {})}
                        onCancel={onCancelEdit ?? (() => {})}
                        owner={owner}
                        repo={repo}
                        minHeight={`${Math.min(Math.max(editBody.split("\n").length * 28, 120), 400)}px`}
                        footerActions={[
                            {
                                label: "Save",
                                onClick: onSaveEdit ?? (() => {}),
                                variant: "approve",
                                disabled: (text: string) => !text.trim(),
                            },
                        ]}
                    />
                ) : (
                    children
                )}
            </div>
            {!isEditing && footer}
        </div>
    );
}
