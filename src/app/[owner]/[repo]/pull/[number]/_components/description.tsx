"use client";

import type { components } from "@octokit/openapi-types";
import { Lock, SquarePen } from "lucide-react";
import NextLink from "next/link";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
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

import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

interface PullRequestDescriptionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData>;
    canInteract: boolean;
}

export function PullRequestDescriptionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    canInteract,
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
                        {(pullRequest) => (
                            <>
                                <h1 className="font-bold text-2xl text-gray-900 dark:text-zinc-100">
                                    {pullRequest.title}
                                </h1>
                                <h1 className="text-2xl text-gray-400 dark:text-zinc-500">
                                    #{number}
                                </h1>
                            </>
                        )}
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
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-700">
                                    {pullRequest.base.ref}
                                </span>
                                <span className="mx-2">←</span>
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                                    {pullRequest.head.ref}
                                </span>
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
                        </div>
                    )}
                </Async>
            </div>

            <div className="mt-4 border-gray-200 border-t pt-4 dark:border-zinc-700" />

            <Async
                fallback={
                    <div className="h-48 w-fill animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                }
                promise={pullRequestPromise}
            >
                {(pullRequest) => {
                    const displayBody = savedBody ?? pullRequest.body;
                    return (
                        <>
                            {/* PR Description */}
                            <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900">
                                <div className="flex items-center justify-between border-gray-200 border-b px-4 py-1 dark:border-zinc-700">
                                    <h3 className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
                                        Description
                                    </h3>
                                    {!isEditing && canInteract && (
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
                                    )}
                                </div>
                                <div className="p-4">
                                    {isEditing ? (
                                        <MarkdownEditor
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
                                                <MarkdownRenderer
                                                    content={displayBody}
                                                    owner={owner}
                                                    repo={repo}
                                                />
                                            ) : (
                                                <p className="text-gray-500 italic dark:text-zinc-400">
                                                    No description provided.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {!isEditing && (
                                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                        {reactionsData &&
                                            reactionsData.reactions.length >
                                                0 && (
                                                <ReactionBar
                                                    disabled={!canInteract}
                                                    reactions={
                                                        reactionsData.reactions
                                                    }
                                                    currentUserLogin={
                                                        currentUserData?.login
                                                    }
                                                    onReact={handleReact}
                                                />
                                            )}
                                        <ReactionPicker
                                            disabled={!canInteract}
                                            reactions={
                                                reactionsData?.reactions ?? []
                                            }
                                            currentUserLogin={
                                                currentUserData?.login
                                            }
                                            onReact={handleReact}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    );
                }}
            </Async>
        </div>
    );
}
