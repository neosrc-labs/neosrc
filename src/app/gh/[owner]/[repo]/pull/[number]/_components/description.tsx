"use client";

import type { components } from "@octokit/openapi-types";
import { Lock, SmilePlus, SquarePen } from "lucide-react";
import NextLink from "next/link";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/code-title";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import {
    extractPullRequestState,
    StatusPill,
} from "~/components/ui/status-pill";
import type { ReactionContent } from "~/lib/reactions";
import type { PullsGetResponseData } from "~/server/github";

type SimpleUser = components["schemas"]["nullable-simple-user"];

import { useTaskToggle } from "~/hooks/use-task-toggle";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

interface PullRequestDescriptionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData>;
    canInteractPromise: Promise<boolean>;
    canEditPromise: Promise<boolean>;
}

export function PullRequestDescriptionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    canInteractPromise,
    canEditPromise,
}: PullRequestDescriptionSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editBody, setEditBody] = useState("");
    const [savedBody, setSavedBody] = useState<string | null>(null);
    const updateMutation = api.pulls.updateBody.useMutation({
        onMutate: () => {
            setSavedBody(editBody);
            setIsEditing(false);
        },
        onError: () => {
            setSavedBody(null);
            setIsEditing(true);
        },
    });

    // Toggle instance for task-list checkbox clicks. Separate from
    // `updateMutation` because its onMutate/onError contract mirrors the
    // toggle flow rather than the edit-mode flow. Both share `savedBody` as
    // the optimistic overlay over `pullRequest.body`; the two flows are never
    // active at the same time (toggles only fire while `!isEditing`).
    const taskToggleMutation = api.pulls.updateBody.useMutation({
        onMutate: ({ body }) => setSavedBody(body),
        onError: () => setSavedBody(null),
    });
    const { onToggleTask } = useTaskToggle({
        mutation: taskToggleMutation,
        staticInput: { owner, repo, number },
    });

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [savedTitle, setSavedTitle] = useState<string | null>(null);
    const updateTitleMutation = api.pulls.updateTitle.useMutation({
        onMutate: () => {
            setSavedTitle(editTitle);
            setIsEditingTitle(false);
        },
        onError: () => {
            setSavedTitle(null);
            setIsEditingTitle(true);
        },
    });

    const { data: currentUserData } = api.users.currentUser.useQuery();

    const { data: reactionsData } = api.reactions.get.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const utils = api.useUtils();

    const toggleIssueMutation = api.reactions.toggleIssue.useMutation({
        onMutate: async ({ content }) => {
            await utils.reactions.get.cancel({ owner, repo, number });
            const prevData = utils.reactions.get.getData({
                owner,
                repo,
                number,
            });
            utils.reactions.get.setData({ owner, repo, number }, (old) => {
                if (!old) return old;
                const userLogin = currentUserData?.login;
                if (!userLogin) return old;
                const existing = old.reactions?.find(
                    (r) => r.user?.login === userLogin && r.content === content,
                );
                const updatedCounts = old.counts
                    ? {
                          ...old.counts,
                          total_count: existing
                              ? old.counts.total_count - 1
                              : old.counts.total_count + 1,
                          [content]: existing
                              ? old.counts[content] - 1
                              : old.counts[content] + 1,
                      }
                    : old.counts;
                return {
                    ...old,
                    reactions: existing
                        ? old.reactions.filter((r) => r.id !== existing.id)
                        : [
                              ...old.reactions,
                              {
                                  id: -Date.now(),
                                  node_id: "",
                                  content,
                                  created_at: new Date().toISOString(),
                                  user: {
                                      login: userLogin,
                                      id: 0,
                                      node_id: "",
                                      avatar_url: "",
                                      gravatar_id: null,
                                      url: "",
                                      html_url: "",
                                      followers_url: "",
                                      following_url: "",
                                      gists_url: "",
                                      starred_url: "",
                                      subscriptions_url: "",
                                      organizations_url: "",
                                      repos_url: "",
                                      events_url: "",
                                      received_events_url: "",
                                      type: "",
                                      site_admin: false,
                                      name: null,
                                      email: null,
                                  } satisfies SimpleUser,
                              },
                          ],
                    counts: updatedCounts,
                };
            });
            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.reactions.get.setData(
                    { owner, repo, number },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.reactions.get.invalidate({ owner, repo, number });
        },
    });

    const handleReact = useCallback(
        (content: ReactionContent) => {
            toggleIssueMutation.mutate({
                owner,
                repo,
                number,
                content,
            });
        },
        [owner, repo, number, toggleIssueMutation],
    );

    const handleStartEdit = useCallback((currentBody: string) => {
        setEditBody(currentBody);
        setIsEditing(true);
    }, []);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditBody("");
    }, []);

    const handleSave = useCallback(() => {
        updateMutation.mutate({ owner, repo, number, body: editBody });
    }, [editBody, owner, repo, number, updateMutation]);

    const handleStartEditTitle = useCallback((currentTitle: string) => {
        setEditTitle(currentTitle);
        setIsEditingTitle(true);
    }, []);

    const handleCancelTitle = useCallback(() => {
        setIsEditingTitle(false);
        setEditTitle("");
    }, []);

    const handleSaveTitle = useCallback(() => {
        updateTitleMutation.mutate({ owner, repo, number, title: editTitle });
    }, [editTitle, owner, repo, number, updateTitleMutation]);

    return (
        <div>
            {/* PR Header */}
            <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                    <Async
                        fallback={
                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                        }
                        promise={pullRequestPromise}
                    >
                        {(pullRequest) => {
                            const state = extractPullRequestState(pullRequest);
                            return (
                                <>
                                    <StatusPill state={state} />
                                    {pullRequest.locked && (
                                        <span className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-500 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                                            <Lock size={12} />
                                            Locked
                                        </span>
                                    )}
                                </>
                            );
                        }}
                    </Async>
                    <Async
                        fallback={
                            <div className="h-8 w-96 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                        }
                        promise={pullRequestPromise}
                    >
                        {(pullRequest) => {
                            const displayTitle =
                                savedTitle ?? pullRequest.title;
                            return (
                                <div className="flex w-full items-center gap-2">
                                    {isEditingTitle ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) =>
                                                    setEditTitle(e.target.value)
                                                }
                                                className="flex-1 border-blue-500 border-b-2 bg-transparent font-bold text-2xl text-gray-900 outline-none dark:text-zinc-100"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        handleSaveTitle();
                                                    if (e.key === "Escape")
                                                        handleCancelTitle();
                                                }}
                                            />
                                            <button
                                                className="cursor-pointer rounded bg-green-600 px-2 py-1 text-white text-xs hover:bg-green-700"
                                                onClick={handleSaveTitle}
                                                type="button"
                                            >
                                                Save
                                            </button>
                                            <button
                                                className="cursor-pointer text-gray-400 text-xs hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                                onClick={handleCancelTitle}
                                                type="button"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <h1 className="font-bold text-2xl text-gray-900 dark:text-zinc-100">
                                                <CodeTitle>
                                                    {displayTitle}
                                                </CodeTitle>
                                            </h1>
                                            <span className="text-2xl text-gray-400 dark:text-zinc-500">
                                                #{number}
                                            </span>
                                            <Async
                                                fallback={null}
                                                promise={canInteractPromise}
                                            >
                                                {(canInteract) =>
                                                    canInteract ? (
                                                        <button
                                                            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                                            onClick={() =>
                                                                handleStartEditTitle(
                                                                    displayTitle,
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <SquarePen
                                                                size={16}
                                                            />
                                                        </button>
                                                    ) : null
                                                }
                                            </Async>
                                        </>
                                    )}
                                </div>
                            );
                        }}
                    </Async>
                </div>

                <Async
                    fallback={
                        <div className="h-5 w-104 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    }
                    promise={pullRequestPromise}
                >
                    {(pullRequest) => (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="text-gray-600 text-sm dark:text-zinc-400">
                                <a
                                    href={`https://github.com/${owner}/${repo}/tree/${pullRequest.base.ref}`}
                                    className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                                >
                                    {pullRequest.base.ref}
                                </a>
                                <span className="mx-2">←</span>
                                <a
                                    href={`https://github.com/${owner}/${repo}/tree/${pullRequest.head.ref}`}
                                    className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                                >
                                    {pullRequest.head.ref}
                                </a>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                                opened by{" "}
                                <UserHoverCard login={pullRequest.user.login}>
                                    <NextLink
                                        className="flex items-center gap-2"
                                        href={pullRequest.user.html_url}
                                    >
                                        <img
                                            alt={pullRequest.user?.login}
                                            className="h-5 w-5 rounded-full"
                                            src={pullRequest.user?.avatar_url}
                                        />
                                        {pullRequest.user?.login}{" "}
                                    </NextLink>
                                </UserHoverCard>
                                {formatRelativeTime(pullRequest.created_at)}
                            </div>
                            <div className="ml-auto flex items-center gap-1.5 text-sm">
                                {pullRequest.additions > 0 && (
                                    <span className="font-medium text-green-600 dark:text-green-500">
                                        +
                                        {pullRequest.additions.toLocaleString()}
                                    </span>
                                )}
                                {pullRequest.deletions > 0 && (
                                    <span className="font-medium text-red-600 dark:text-red-500">
                                        -
                                        {pullRequest.deletions.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </Async>
            </div>

            <Async
                fallback={
                    <div className="h-48 w-fill animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                }
                promise={pullRequestPromise}
            >
                {(pullRequest) => {
                    const displayBody = savedBody ?? pullRequest.body;
                    return (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="flex items-center justify-between border-gray-200 border-b px-4 py-1 dark:border-zinc-700">
                                <h3 className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
                                    Description
                                </h3>
                                <Async
                                    fallback={null}
                                    promise={canInteractPromise}
                                >
                                    {(canInteract) =>
                                        !isEditing && canInteract ? (
                                            <button
                                                className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                onClick={() =>
                                                    handleStartEdit(
                                                        savedBody ??
                                                            pullRequest.body ??
                                                            "",
                                                    )
                                                }
                                                type="button"
                                            >
                                                <SquarePen size={16} />
                                            </button>
                                        ) : null
                                    }
                                </Async>
                            </div>
                            <div className="p-4">
                                {isEditing ? (
                                    <MarkdownEditor
                                        autoFocus
                                        onCancel={handleCancel}
                                        onChange={setEditBody}
                                        value={editBody}
                                        owner={owner}
                                        repo={repo}
                                        minHeight="200px"
                                        footerActions={[
                                            {
                                                label: "Save",
                                                onClick: () => handleSave(),
                                                variant: "approve",
                                            },
                                        ]}
                                    />
                                ) : (
                                    <div className="prose prose-sm max-w-none">
                                        {displayBody ? (
                                            <Async
                                                fallback={
                                                    <MarkdownRenderer
                                                        content={displayBody}
                                                        owner={owner}
                                                        repo={repo}
                                                    />
                                                }
                                                promise={canEditPromise}
                                            >
                                                {(canEdit) => (
                                                    <MarkdownRenderer
                                                        canToggleTasks={canEdit}
                                                        content={displayBody}
                                                        onToggleTask={
                                                            onToggleTask
                                                        }
                                                        owner={owner}
                                                        repo={repo}
                                                    />
                                                )}
                                            </Async>
                                        ) : (
                                            <p className="text-gray-500 italic dark:text-zinc-400">
                                                No description provided.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!isEditing && (
                                <Async
                                    fallback={
                                        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                            <button
                                                type="button"
                                                aria-hidden="true"
                                                tabIndex={-1}
                                                className="rounded p-1 opacity-0"
                                            >
                                                <SmilePlus size={14} />
                                            </button>
                                        </div>
                                    }
                                    promise={canInteractPromise}
                                >
                                    {(canInteract) => {
                                        const reactionCounts =
                                            reactionsData?.counts
                                                ? {
                                                      "+1": reactionsData
                                                          .counts["+1"],
                                                      "-1": reactionsData
                                                          .counts["-1"],
                                                      laugh: reactionsData
                                                          .counts.laugh,
                                                      confused:
                                                          reactionsData.counts
                                                              .confused,
                                                      heart: reactionsData
                                                          .counts.heart,
                                                      hooray: reactionsData
                                                          .counts.hooray,
                                                      rocket: reactionsData
                                                          .counts.rocket,
                                                      eyes: reactionsData.counts
                                                          .eyes,
                                                  }
                                                : undefined;
                                        return (
                                            <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                                <ReactionPicker
                                                    disabled={!canInteract}
                                                    reactions={
                                                        reactionsData?.reactions ??
                                                        []
                                                    }
                                                    currentUserLogin={
                                                        currentUserData?.login
                                                    }
                                                    onReact={handleReact}
                                                />
                                                <ReactionBar
                                                    disabled={!canInteract}
                                                    reactions={
                                                        reactionsData?.reactions ??
                                                        []
                                                    }
                                                    counts={reactionCounts}
                                                    currentUserLogin={
                                                        currentUserData?.login
                                                    }
                                                    onReact={handleReact}
                                                />
                                            </div>
                                        );
                                    }}
                                </Async>
                            )}
                        </div>
                    );
                }}
            </Async>
        </div>
    );
}
