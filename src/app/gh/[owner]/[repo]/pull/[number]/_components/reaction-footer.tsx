"use client";

import { useCallback } from "react";
import { ReactionBar } from "~/components/reaction-bar";
import { ReactionPicker } from "~/components/reaction-picker";
import type { ReactionContent } from "~/lib/reactions";
import type { GQLPullRequestReactions } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import {
    canInteract,
    type PullRequestPermissionContext,
} from "../permissions-utils";

type SubjectReactionsData = Pick<
    GQLPullRequestReactions,
    "reactions" | "counts"
> & {
    currentUserLogin: string | undefined;
};

interface ReactionStore {
    cancel: () => Promise<void>;
    get: () => SubjectReactionsData | undefined;
    set: (
        updater: (
            old: SubjectReactionsData | undefined,
        ) => SubjectReactionsData | undefined,
    ) => void;
    invalidate: () => void;
}

/**
 * Reactions footer shared by the pull request and issue description cards.
 * Both subjects expose the same reactions shape; only the query and cache
 * key differ (`number` vs `issueNumber`).
 */
export function ReactionFooter({
    owner,
    repo,
    number,
    kind,
    reactionsData,
    permissionContext,
}: {
    owner: string;
    repo: string;
    number: number;
    kind: "pull" | "issue";
    reactionsData: SubjectReactionsData | undefined;
    permissionContext: PullRequestPermissionContext;
}) {
    const isIssue = kind === "issue";
    const { data: currentUserData } = api.users.currentUser.useQuery();
    const utils = api.useUtils();

    const store: ReactionStore = isIssue
        ? {
              cancel: () =>
                  utils.reactions.getForIssue.cancel({
                      owner,
                      repo,
                      issueNumber: number,
                  }),
              get: () =>
                  utils.reactions.getForIssue.getData({
                      owner,
                      repo,
                      issueNumber: number,
                  }),
              set: (updater) =>
                  utils.reactions.getForIssue.setData(
                      { owner, repo, issueNumber: number },
                      updater,
                  ),
              invalidate: () =>
                  utils.reactions.getForIssue.invalidate({
                      owner,
                      repo,
                      issueNumber: number,
                  }),
          }
        : {
              cancel: () => utils.reactions.get.cancel({ owner, repo, number }),
              get: () => utils.reactions.get.getData({ owner, repo, number }),
              set: (updater) =>
                  utils.reactions.get.setData({ owner, repo, number }, updater),
              invalidate: () =>
                  utils.reactions.get.invalidate({ owner, repo, number }),
          };

    const toggleMutation = api.reactions.toggleIssue.useMutation({
        onMutate: async ({ content }) => {
            await store.cancel();
            const prevData = store.get();
            store.set((old) => {
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
                                  user: { login: userLogin },
                              },
                          ],
                    counts: updatedCounts,
                };
            });
            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                store.set(() => ctx.prevData);
            }
        },
        onSettled: () => {
            store.invalidate();
        },
    });

    const handleReact = useCallback(
        (content: ReactionContent) => {
            toggleMutation.mutate({
                owner,
                repo,
                number,
                content,
            });
        },
        [owner, repo, number, toggleMutation],
    );

    const canReact = canInteract(permissionContext);

    const reactionCounts = reactionsData?.counts
        ? {
              "+1": reactionsData.counts["+1"],
              "-1": reactionsData.counts["-1"],
              laugh: reactionsData.counts.laugh,
              confused: reactionsData.counts.confused,
              heart: reactionsData.counts.heart,
              hooray: reactionsData.counts.hooray,
              rocket: reactionsData.counts.rocket,
              eyes: reactionsData.counts.eyes,
          }
        : undefined;

    // Signed-out visitors still see the existing reactions; only adding one
    // requires an authenticated viewer.
    if (!canReact && (reactionsData?.counts?.total_count ?? 0) === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
            {canReact && (
                <ReactionPicker
                    reactions={reactionsData?.reactions ?? []}
                    currentUserLogin={currentUserData?.login}
                    onReact={handleReact}
                />
            )}
            <ReactionBar
                reactions={reactionsData?.reactions ?? []}
                counts={reactionCounts}
                currentUserLogin={currentUserData?.login}
                onReact={handleReact}
                disabled={!canReact}
            />
        </div>
    );
}
