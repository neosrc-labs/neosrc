import type { components } from "@octokit/openapi-types";
import { api } from "~/trpc/react";

type OctokitReaction = components["schemas"]["reaction"];

function toggleOctokitReactions(
    items: OctokitReaction[],
    login: string,
    content: string,
): OctokitReaction[] {
    const existing = items.find(
        (r) => r.user?.login === login && r.content === content,
    );
    if (existing) {
        return items.filter((r) => r.id !== existing.id);
    }
    return [
        ...items,
        {
            id: -Date.now(),
            node_id: "",
            user: {
                login,
                avatar_url: "",
                html_url: "",
                id: 0,
                node_id: "",
                gravatar_id: "",
                url: "",
                received_events_url: "",
                type: "User",
                site_admin: false,
            },
            content,
            created_at: new Date().toISOString(),
        } as OctokitReaction,
    ];
}

export function useTogglePullRequestReviewCommentReaction(
    owner: string,
    repo: string,
    commentIds: number[],
    currentUserLogin: string,
) {
    const utils = api.useUtils();

    return api.reactions.togglePullRequestReviewComment.useMutation({
        onMutate: async ({ commentId, content }) => {
            await utils.reactions.getForReviewComments.cancel({
                owner,
                repo,
                commentIds,
            });

            const prevData = utils.reactions.getForReviewComments.getData({
                owner,
                repo,
                commentIds,
            });

            utils.reactions.getForReviewComments.setData(
                { owner, repo, commentIds },
                (old) => {
                    if (!old) return old;
                    const prevReactions: OctokitReaction[] =
                        old[commentId] ?? [];
                    const updatedReactions = toggleOctokitReactions(
                        prevReactions,
                        currentUserLogin,
                        content as string,
                    );
                    return { ...old, [commentId]: updatedReactions };
                },
            );

            return { prevData };
        },
        onError: (err, _vars, ctx) => {
            console.error("Failed to toggle reaction:", err);
            if (ctx?.prevData) {
                utils.reactions.getForReviewComments.setData(
                    { owner, repo, commentIds },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.reactions.getForReviewComments.invalidate({
                owner,
                repo,
                commentIds,
            });
        },
    });
}
