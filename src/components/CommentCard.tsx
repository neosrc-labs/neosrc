"use client";

import type { ReactNode } from "react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
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
    isOutdated?: boolean;
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
    hideAvatar?: boolean;
    id?: string;
}

export function CommentCard({
    user,
    userHref,
    createdAt,
    authorAssociation,
    isPending,
    isOutdated,
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
    hideAvatar = false,
    id,
}: CommentCardProps) {
    const userElement = user && (
        <>
            {!hideAvatar && (
                <img
                    alt={user.login ?? "user"}
                    className="h-5 w-5 flex-shrink-0 rounded-full"
                    src={user.avatar_url ?? ""}
                />
            )}
            <span className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
                {user.login ?? "unknown"}
            </span>
        </>
    );

    return (
        <div
            id={id}
            className={
                variant === "default"
                    ? "relative border-b-1 border-b-gray-200 border-solid bg-white dark:border-b-zinc-700 dark:bg-zinc-900"
                    : variant === "standalone"
                      ? "relative rounded border-1 border-gray-200 border-solid bg-white dark:border-zinc-700 dark:bg-zinc-900"
                      : "relative bg-gray-50 dark:bg-zinc-950"
            }
        >
            {hideAvatar && (
                <svg
                    width="8"
                    height="16"
                    viewBox="0 0 8 16"
                    className="absolute top-[9px] -left-2"
                    aria-hidden="true"
                >
                    <path
                        d="M 8,0 L 0,8 L 8,16"
                        className="stroke-gray-200 dark:stroke-zinc-700"
                        fill="none"
                        strokeWidth="1"
                    />
                    <polygon
                        points="8,0 0,8 8,16"
                        className="fill-white dark:fill-zinc-900"
                    />
                </svg>
            )}
            <div className="flex items-center justify-between gap-2 px-4 pt-2">
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
                    {isOutdated && (
                        <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                            Outdated
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
            <div
                className={`prose prose-sm dark:prose-invert max-w-none py-2 ${
                    hideAvatar ? "px-4" : "mx-6 px-4"
                }`}
            >
                {isEditing ? (
                    <MarkdownEditor
                        autoFocus
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
