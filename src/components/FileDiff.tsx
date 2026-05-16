"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";
import { isGeneratedFile } from "~/utils/generated-files";
import { type ActiveComment, DiffView } from "./DiffView";

interface FileDiffProps {
    file: {
        filename: string;
        patch?: string | null;
        status: string;
        additions: number;
        deletions: number;
    };
    owner: string;
    repo: string;
    number: string;
    comments?: ReviewComment[];
    showComments?: boolean;
    pendingReviewId?: number | null;
}

function getViewedKey(owner: string, repo: string, number: string): string {
    return `pr-file:viewed:${owner}:${repo}:${number}`;
}

function getStoredSet(key: string): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const data = localStorage.getItem(key);
        if (!data) return new Set();
        return new Set(JSON.parse(data) as string[]);
    } catch {
        return new Set();
    }
}

function setStoredSet(key: string, set: Set<string>): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

export default function FileDiff({
    file,
    owner,
    repo,
    number,
    comments = [],
    showComments = true,
    pendingReviewId,
}: FileDiffProps) {
    const [isViewed, setIsViewed] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(isViewed);
    const [showGeneratedDiff, setShowGeneratedDiff] = useState(false);
    const [activeComment, setActiveComment] = useState<ActiveComment | null>(
        null,
    );
    const [commentBody, setCommentBody] = useState("");
    const utils = api.useUtils();

    const generated = isGeneratedFile(file.filename);

    const fileId = file.filename.replace(/\//g, "-");

    useEffect(() => {
        const viewed = getStoredSet(getViewedKey(owner, repo, number));
        const wasViewed = viewed.has(file.filename);
        setIsViewed(wasViewed);
        setIsCollapsed(wasViewed);
    }, [owner, repo, number, file.filename]);

    const createMutation = api.reviewComments.create.useMutation({
        onSuccess: () => {
            setCommentBody("");
            setActiveComment(null);
            utils.reviewComments.list.invalidate();
            utils.reviews.getPending.invalidate();
        },
    });

    const startReviewMutation = api.reviews.start.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
        },
    });

    const handleAddComment = useCallback(
        (isReview: boolean) => {
            if (!commentBody.trim() || !activeComment) return;
            const args = {
                owner,
                repo,
                number: Number(number),
                filePath: file.filename,
                lineNumber: activeComment.line,
                side: activeComment.side,
                body: commentBody,
                asReview: isReview,
            };

            const doCreateComment = () => {
                createMutation.mutate(args);
            };

            if (isReview && !pendingReviewId) {
                startReviewMutation.mutate(
                    { owner, repo, number: Number(number) },
                    { onSuccess: doCreateComment },
                );
            } else {
                doCreateComment();
            }
        },
        [
            commentBody,
            activeComment,
            createMutation,
            startReviewMutation,
            pendingReviewId,
            owner,
            repo,
            number,
            file.filename,
        ],
    );

    const footerActions = pendingReviewId
        ? [
              {
                  label: "Add to Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ]
        : [
              {
                  label: "Add single comment",
                  onClick: () => handleAddComment(false),
                  variant: "neutral" as const,
                  disabled: (text: string) => !text.trim(),
              },
              {
                  label: "Start a Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ];

    const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

    const toggleViewed = () => {
        const key = getViewedKey(owner, repo, number);
        const viewed = getStoredSet(key);
        if (isViewed) {
            viewed.delete(file.filename);
        } else {
            viewed.add(file.filename);
        }
        setStoredSet(key, viewed);
        setIsViewed(!isViewed);
        if (!isViewed && !isCollapsed) {
            toggleCollapsed();
        } else if (isViewed && isCollapsed) {
            toggleCollapsed();
        }
    };

    const statusColor =
        file.status === "added"
            ? "text-green-600"
            : file.status === "deleted"
              ? "text-red-600"
              : file.status === "renamed"
                ? "text-blue-600"
                : "text-yellow-600";

    return (
        <div
            className="mb-6 scroll-mt-[calc(var(--header-height)+8px)] overflow-hidden rounded border border-gray-200 dark:border-zinc-700"
            id={fileId}
        >
            <div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                <button
                    className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={toggleCollapsed}
                    type="button"
                >
                    <svg
                        className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <title>Toggle collapse</title>
                        <path
                            d="M19 9l-7 7-7-7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                        />
                    </svg>
                </button>

                <button
                    className="h-4 w-4 cursor-pointer text-gray-500 dark:text-gray-400"
                    onClick={toggleCollapsed}
                    type="button"
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <title>File</title>
                        <path
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                        />
                    </svg>
                </button>

                <button
                    className="flex-1 cursor-pointer truncate text-left font-mono text-gray-700 text-sm dark:text-gray-300"
                    onClick={toggleCollapsed}
                    type="button"
                >
                    {file.filename}
                </button>

                <span className={`font-medium text-xs ${statusColor}`}>
                    {file.status}
                </span>

                {file.additions > 0 && (
                    <span className="font-medium text-green-600 text-xs">
                        +{file.additions}
                    </span>
                )}
                {file.deletions > 0 && (
                    <span className="font-medium text-red-600 text-xs">
                        -{file.deletions}
                    </span>
                )}

                <label className="flex cursor-pointer items-center gap-1 text-gray-600 text-xs hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                    <input
                        checked={isViewed}
                        className="cursor-pointer rounded border-gray-300 dark:border-zinc-600"
                        onChange={toggleViewed}
                        type="checkbox"
                    />
                    Viewed
                </label>
            </div>

            {!isCollapsed &&
                (generated && !showGeneratedDiff ? (
                    <div className="flex flex-col items-center gap-2 border-gray-200 border-t px-4 py-6 text-gray-500 text-sm dark:border-gray-700 dark:text-gray-400">
                        <span>
                            This file is generated and hidden by default.
                        </span>
                        <button
                            className="cursor-pointer font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => setShowGeneratedDiff(true)}
                            type="button"
                        >
                            Show changes
                        </button>
                    </div>
                ) : file.patch ? (
                    <DiffView
                        patch={file.patch}
                        filename={file.filename}
                        comments={showComments ? comments : undefined}
                        showComments={showComments}
                        showCommentButton={showComments}
                        activeComment={activeComment}
                        onStartComment={setActiveComment}
                        commentBody={commentBody}
                        onCommentBodyChange={setCommentBody}
                        commentPending={
                            createMutation.isPending ||
                            startReviewMutation.isPending
                        }
                        commentError={
                            createMutation.isError ||
                            startReviewMutation.isError
                        }
                        onCancelComment={() => {
                            setActiveComment(null);
                            setCommentBody("");
                        }}
                        footerActions={footerActions}
                        pendingReviewId={pendingReviewId}
                        owner={owner}
                        repo={repo}
                        pullNumber={number}
                    />
                ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm italic dark:text-gray-400">
                        {file.patch === null
                            ? "Binary file not shown"
                            : "No changes"}
                    </div>
                ))}
        </div>
    );
}
